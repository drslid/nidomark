import type { Proposal, Target } from './types';

/** A bookmark or folder as returned by the bookmarks API. */
export interface NodeView {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
}

/** Minimal bookmarks API, satisfied by `browser.bookmarks` in Chrome and Firefox (and by test fakes). */
export interface BookmarksApi {
  get(id: string): Promise<NodeView[]>;
  getChildren(id: string): Promise<NodeView[]>;
  create(details: { parentId: string; title: string; url?: string; index?: number }): Promise<{ id: string }>;
  move(id: string, destination: { parentId: string; index?: number }): Promise<unknown>;
  update(id: string, changes: { title?: string }): Promise<unknown>;
  remove(id: string): Promise<unknown>;
  removeTree(id: string): Promise<unknown>;
}

export type FolderStyle = 'name' | 'emoji-name' | 'emoji';

export interface Decisions {
  moves: Record<string, { accepted: boolean; target: Target }>;
  titles: Record<string, { accepted: boolean; title: string }>;
  newFolders: Record<string, { accepted: boolean; name: string; emoji: string }>;
  folderEmojis: Record<string, { accepted: boolean; emoji: string }>;
  iconOnly: Record<string, boolean>;
  /** Duplicates to remove (true) or keep. */
  removes: Record<string, boolean>;
  folderStyle: FolderStyle;
}

/** State a node must still have for an operation to apply: anything else means the user changed it meanwhile. */
export interface Expected {
  parentId?: string;
  title: string;
  url?: string;
}

export interface BackupSource {
  id: string;
  /** Name of the copy of this folder inside the backup ("Bookmarks bar"). */
  title: string;
}

export type Op =
  | { type: 'backup'; parentId: string; title: string; sources: BackupSource[] }
  | { type: 'createFolder'; key: string; parentId?: string; parentKey?: string; title: string }
  | { type: 'move'; id: string; to: { folderId?: string; newKey?: string }; expect: Expected }
  | { type: 'rename'; id: string; title: string; expect: Expected; iconOnly?: boolean }
  | { type: 'remove'; id: string; expect: Expected };

export function folderTitle(name: string, emoji: string, style: FolderStyle): string {
  if (style === 'emoji' && emoji) return emoji;
  if (style === 'emoji-name' && emoji) return `${emoji} ${name}`;
  return name;
}

/** Subfolders keep their name: an emoji alone is only readable at the top, side by side in the bar. */
export function nestedStyle(style: FolderStyle): FolderStyle {
  return style === 'emoji' ? 'emoji-name' : style;
}

/** Default decisions: every proposed change is accepted, icon-only applied to the given bar bookmarks. */
export function defaultDecisions(p: Proposal, style: FolderStyle, iconOnlyIds: string[] = []): Decisions {
  return {
    moves: Object.fromEntries(p.placements.filter((pl) => pl.target.kind !== 'stay').map((pl) => [pl.bookmarkId, { accepted: true, target: pl.target }])),
    titles: Object.fromEntries(Object.entries(p.titles).map(([id, title]) => [id, { accepted: true, title }])),
    newFolders: Object.fromEntries(p.newFolders.map((f) => [f.key, { accepted: true, name: f.name, emoji: f.emoji }])),
    folderEmojis: Object.fromEntries(Object.entries(p.folderEmojis).map(([id, emoji]) => [id, { accepted: style !== 'name', emoji }])),
    iconOnly: Object.fromEntries(iconOnlyIds.map((id) => [id, true])),
    removes: Object.fromEntries(p.duplicates.map((x) => [x.bookmarkId, true])),
    folderStyle: style,
  };
}

/** Current state of the nodes, as known when the plan is built. */
export interface Current {
  node: (id: string) => Expected | undefined;
  /** Root folders (bookmarks bar, other bookmarks): folders created there are top-level. */
  roots?: Set<string>;
  /**
   * Where the sorted folders go. Only folders at its top take the "emoji only" style, side by side in the bar;
   * anywhere else a folder keeps its name after the emoji.
   */
  destinationRoot?: string;
}

/** A new folder is created only if it is accepted and so is every new folder above it. */
export function acceptedFolders(p: Proposal, d: Decisions): Set<string> {
  const byKey = new Map(p.newFolders.map((f) => [f.key, f]));
  const ok = new Set<string>();
  const check = (key: string, depth = 0): boolean => {
    const f = byKey.get(key);
    if (!f || !d.newFolders[key]?.accepted || depth > 8) return false;
    return !f.parentKey || check(f.parentKey, depth + 1);
  };
  for (const f of p.newFolders) if (check(f.key)) ok.add(f.key);
  return ok;
}

/** Ordered operations: back up, create folders, move bookmarks, remove duplicates, then rename. */
export function buildPlan(p: Proposal, d: Decisions, current: Current, backup?: { parentId: string; title: string; sources: BackupSource[] }): Op[] {
  const ops: Op[] = [];
  const accepted = acceptedFolders(p, d);
  const used = new Set<string>();
  const byKey = new Map(p.newFolders.map((f) => [f.key, f]));
  for (const m of Object.values(d.moves)) {
    if (!m.accepted || m.target.kind !== 'new' || !accepted.has(m.target.key)) continue;
    // A subfolder needs its group folder.
    for (let k: string | undefined = m.target.key; k && !used.has(k); k = byKey.get(k)?.parentKey) used.add(k);
  }
  const moves: Op[] = [];
  for (const [id, m] of Object.entries(d.moves)) {
    if (!m.accepted || m.target.kind === 'stay') continue;
    if (m.target.kind === 'new' && !accepted.has(m.target.key)) continue;
    const cur = current.node(id);
    if (!cur) continue;
    const to = m.target.kind === 'existing' ? { folderId: m.target.folderId } : { newKey: m.target.key };
    if (to.folderId === cur.parentId) continue;
    moves.push({ type: 'move', id, to, expect: cur });
  }
  const removes: Op[] = [];
  for (const [id, on] of Object.entries(d.removes ?? {})) {
    const cur = current.node(id);
    if (on && cur && !d.moves[id]?.accepted) removes.push({ type: 'remove', id, expect: cur });
  }
  if (backup && (moves.length || used.size || removes.length)) ops.push({ type: 'backup', ...backup });
  for (const f of p.newFolders) {
    const nf = d.newFolders[f.key];
    if (!nf || !used.has(f.key)) continue;
    const nested = !!f.parentKey || (!!current.roots && !current.roots.has(f.parentId)) || (!!current.destinationRoot && f.parentId !== current.destinationRoot);
    ops.push({ type: 'createFolder', key: f.key, parentId: f.parentKey ? undefined : f.parentId, parentKey: f.parentKey, title: folderTitle(nf.name, nf.emoji, nested ? nestedStyle(d.folderStyle) : d.folderStyle) });
  }
  ops.push(...moves, ...removes);
  for (const [id, t] of Object.entries(d.titles)) {
    const cur = current.node(id);
    if (!t.accepted || !cur || d.iconOnly[id] || t.title === cur.title || d.removes?.[id]) continue;
    ops.push({ type: 'rename', id, title: t.title, expect: cur });
  }
  for (const [id, on] of Object.entries(d.iconOnly)) {
    const cur = current.node(id);
    if (on && cur?.title) ops.push({ type: 'rename', id, title: '', expect: cur, iconOnly: true });
  }
  if (d.folderStyle !== 'name') {
    for (const [id, fe] of Object.entries(d.folderEmojis)) {
      const cur = current.node(id);
      if (!fe.accepted || !cur?.title) continue;
      // The user's own folders never lose their name: the emoji only goes in front of it.
      const next = folderTitle(cur.title, fe.emoji, nestedStyle(d.folderStyle));
      if (next !== cur.title) ops.push({ type: 'rename', id, title: next, expect: cur });
    }
  }
  return ops;
}

export interface Snap {
  parentId?: string;
  index?: number;
  title: string;
  /** For folder creation: ids of the parent's children before, to find the folder after an interruption. */
  siblings?: string[];
  /** For a backup: number of folders and bookmarks copied. */
  count?: number;
}

export interface JournalEntry {
  op: Op;
  /** pending = written before the change, which may or may not have happened. */
  status: 'pending' | 'done' | 'failed' | 'undone';
  createdId?: string;
  before?: Snap;
  after?: Snap;
  error?: string;
}

export interface Journal {
  id: string;
  createdAt: number;
  status: 'applying' | 'applied' | 'undoing' | 'undone';
  entries: JournalEntry[];
}

export interface JournalStore {
  load(): Promise<Journal | null>;
  save(j: Journal): Promise<void>;
}

export interface RunResult {
  done: number;
  skipped: { op: Op; reason: string }[];
}

/** A previous run stopped half-way (browser closed, crash): it must be undone or kept before anything else. */
export class UnresolvedJournalError extends Error {
  constructor() {
    super('unresolved-journal');
  }
}

export function isUnresolved(j: Journal | null): boolean {
  return j?.status === 'applying' || j?.status === 'undoing';
}

/** Moves and renames are journaled by batches: their effect can be checked one by one after an interruption. */
const BATCH = 50;

async function getNode(api: BookmarksApi, id: string): Promise<NodeView | undefined> {
  try {
    return (await api.get(id))[0];
  } catch {
    return undefined;
  }
}

function asNode(value: unknown): NodeView | undefined {
  return value && typeof value === 'object' && 'id' in value ? (value as NodeView) : undefined;
}

const snap = (n: NodeView): Snap => ({ parentId: n.parentId, index: n.index, title: n.title });

function sameAsExpected(cur: NodeView, e: Expected, checkParent: boolean): boolean {
  return cur.title === e.title && (cur.url ?? undefined) === (e.url ?? undefined) && (!checkParent || cur.parentId === e.parentId);
}

/** Copies folders and bookmarks under `parentId`, skipping earlier backups; returns the number of nodes created. */
async function copyTree(api: BookmarksApi, sourceId: string, parentId: string, skip: (n: NodeView) => boolean): Promise<number> {
  let count = 0;
  for (const child of await api.getChildren(sourceId)) {
    if (skip(child)) continue;
    if (child.url !== undefined) {
      await api.create({ parentId, title: child.title, url: child.url });
      count++;
    } else {
      const folder = await api.create({ parentId, title: child.title });
      count += 1 + (await copyTree(api, child.id, folder.id, skip));
    }
  }
  return count;
}

async function countTree(api: BookmarksApi, id: string): Promise<number> {
  let n = 0;
  for (const c of await api.getChildren(id)) n += 1 + (c.url === undefined ? await countTree(api, c.id) : 0);
  return n;
}

export const isBackupFolderTitle = (title: string) => /^nidomark\b.*\b(sauvegarde|backup)\b/i.test(title);

/** Applies the plan. Each change is journaled before it happens, so that an interruption can always be undone or kept. */
export async function applyPlan(api: BookmarksApi, ops: Op[], store: JournalStore, onProgress?: (done: number, total: number) => void): Promise<RunResult & { journal: Journal }> {
  if (isUnresolved(await store.load())) throw new UnresolvedJournalError();
  const journal: Journal = { id: `run-${Date.now()}`, createdAt: Date.now(), status: 'applying', entries: [] };
  const created = new Map<string, string>();
  const skipped: RunResult['skipped'] = [];
  let done = 0;
  await store.save(journal);
  const fail = (entry: JournalEntry, e: unknown) => {
    entry.status = 'failed';
    entry.error = e instanceof Error ? e.message : String(e);
    skipped.push({ op: entry.op, reason: entry.error });
  };
  const progress = () => onProgress?.(done + skipped.length, ops.length);

  let i = 0;
  while (i < ops.length) {
    const op = ops[i] as Op;
    if (op.type === 'backup') {
      const entry: JournalEntry = { op, status: 'pending' };
      try {
        entry.before = { parentId: op.parentId, title: op.title, siblings: (await api.getChildren(op.parentId)).map((c) => c.id) };
      } catch (e) {
        fail(entry, e);
        journal.entries.push(entry);
        await store.save(journal);
        progress();
        i++;
        continue;
      }
      journal.entries.push(entry);
      await store.save(journal);
      try {
        const root = await api.create({ parentId: op.parentId, title: op.title });
        entry.createdId = root.id;
        await store.save(journal);
        let count = 0;
        for (const s of op.sources) {
          const folder = await api.create({ parentId: root.id, title: s.title });
          count += 1 + (await copyTree(api, s.id, folder.id, (n) => n.id === root.id || (n.url === undefined && isBackupFolderTitle(n.title))));
        }
        entry.after = { parentId: op.parentId, title: op.title, count };
        entry.status = 'done';
        done++;
      } catch (e) {
        // A backup that could not be completed is not a backup: stop before moving anything.
        fail(entry, e);
        await store.save(journal);
        journal.status = 'applied';
        await store.save(journal);
        for (const rest of ops.slice(i + 1)) skipped.push({ op: rest, reason: 'no-backup' });
        progress();
        return { done, skipped, journal };
      }
      await store.save(journal);
      progress();
      i++;
      continue;
    }
    if (op.type === 'createFolder') {
      const entry: JournalEntry = { op, status: 'pending' };
      const parentId = op.parentKey ? created.get(op.parentKey) : op.parentId;
      try {
        if (!parentId) throw new Error('no-folder');
        entry.before = { parentId, title: op.title, siblings: (await api.getChildren(parentId)).map((c) => c.id) };
      } catch (e) {
        fail(entry, e);
        journal.entries.push(entry);
        await store.save(journal);
        progress();
        i++;
        continue;
      }
      journal.entries.push(entry);
      await store.save(journal);
      try {
        const node = await api.create({ parentId: parentId as string, title: op.title });
        created.set(op.key, node.id);
        entry.createdId = node.id;
        entry.after = { parentId, title: op.title };
        entry.status = 'done';
        done++;
      } catch (e) {
        fail(entry, e);
      }
      await store.save(journal);
      progress();
      i++;
      continue;
    }
    // Moves, removals and renames, by batches: check every precondition, journal the batch, then change.
    const batch: { entry: JournalEntry; target?: string }[] = [];
    while (i < ops.length && batch.length < BATCH) {
      const next = ops[i] as Op;
      if (next.type !== 'move' && next.type !== 'rename' && next.type !== 'remove') break;
      const entry: JournalEntry = { op: next, status: 'pending' };
      try {
        const cur = await getNode(api, next.id);
        if (!cur) throw new Error('missing');
        if (!sameAsExpected(cur, next.expect, next.type !== 'rename')) throw new Error('changed');
        let target: string | undefined;
        if (next.type === 'move') {
          target = next.to.folderId ?? created.get(next.to.newKey ?? '');
          if (!target) throw new Error('no-folder');
        }
        entry.before = snap(cur);
        batch.push({ entry, target });
      } catch (e) {
        fail(entry, e);
        journal.entries.push(entry);
      }
      i++;
    }
    // Last positions first in each folder: the positions noted above stay true while the batch runs, and undoing
    // in reverse order puts every bookmark back exactly where it was.
    const pos = (x: { entry: JournalEntry }) => (x.entry.op.type === 'rename' ? -1 : (x.entry.before?.index ?? 0));
    batch.sort((a, b) => Number(a.entry.op.type === 'rename') - Number(b.entry.op.type === 'rename') || String(a.entry.before?.parentId).localeCompare(String(b.entry.before?.parentId)) || pos(b) - pos(a));
    for (const x of batch) journal.entries.push(x.entry);
    await store.save(journal);
    for (const { entry, target } of batch) {
      const bop = entry.op as Extract<Op, { type: 'move' | 'rename' | 'remove' }>;
      try {
        if (bop.type === 'remove') {
          await api.remove(bop.id);
          entry.status = 'done';
          done++;
          continue;
        }
        const res = asNode(bop.type === 'move' ? await api.move(bop.id, { parentId: target as string }) : await api.update(bop.id, { title: bop.title }));
        const after = res ?? (await getNode(api, bop.id));
        entry.after = after ? snap(after) : { parentId: bop.type === 'move' ? target : entry.before?.parentId, title: bop.type === 'rename' ? bop.title : (entry.before?.title ?? '') };
        entry.status = 'done';
        done++;
      } catch (e) {
        fail(entry, e);
      }
    }
    await store.save(journal);
    progress();
  }
  journal.status = 'applied';
  await store.save(journal);
  return { done, skipped, journal };
}

/** Decides from the bookmarks themselves whether the change of each pending entry happened. */
async function reconcile(api: BookmarksApi, journal: Journal): Promise<void> {
  const createdByKey = new Map<string, string>();
  for (const entry of journal.entries) {
    const { op } = entry;
    if (entry.status === 'pending') {
      if (op.type === 'backup' || op.type === 'createFolder') {
        const parentId = entry.before?.parentId;
        if (!entry.createdId && parentId) {
          const before = new Set(entry.before?.siblings ?? []);
          const children = await api.getChildren(parentId).catch(() => [] as NodeView[]);
          entry.createdId = children.find((c) => !before.has(c.id) && c.url === undefined && c.title === op.title)?.id;
        }
        if (entry.createdId) {
          // An interrupted backup is incomplete: its size is unknown, undo removes it whole.
          entry.after = { parentId, title: op.title };
          entry.status = 'done';
        } else entry.status = 'failed';
      } else if (op.type === 'remove') {
        entry.status = (await getNode(api, op.id)) ? 'failed' : 'done';
      } else {
        const cur = await getNode(api, op.id);
        const target = op.type === 'move' ? (op.to.folderId ?? createdByKey.get(op.to.newKey ?? '')) : undefined;
        const happened = !!cur && (op.type === 'move' ? cur.parentId === target : cur.title === op.title && cur.title !== entry.before?.title);
        if (cur && happened) {
          entry.after = snap(cur);
          entry.status = 'done';
        } else entry.status = 'failed';
      }
    }
    if (op.type === 'createFolder' && entry.createdId && entry.status === 'done') createdByKey.set(op.key, entry.createdId);
  }
}

/** Keeps the changes of an interrupted run, so that "Undo" works on them later. */
export async function keepInterrupted(api: BookmarksApi, store: JournalStore): Promise<void> {
  const journal = await store.load();
  if (!journal || !isUnresolved(journal)) return;
  await reconcile(api, journal);
  journal.status = journal.status === 'undoing' ? 'undone' : 'applied';
  await store.save(journal);
}

/** Undoes the last run in reverse order; anything the user changed since is skipped, never overwritten or deleted. */
export async function undoLast(api: BookmarksApi, store: JournalStore, onProgress?: (done: number, total: number) => void): Promise<RunResult> {
  const journal = await store.load();
  if (!journal || journal.status === 'undone') return { done: 0, skipped: [] };
  await reconcile(api, journal);
  journal.status = 'undoing';
  await store.save(journal);
  const skipped: RunResult['skipped'] = [];
  let done = 0;
  let sinceSave = 0;
  const entries = [...journal.entries].reverse().filter((e) => e.status === 'done');
  for (const entry of entries) {
    const { op } = entry;
    try {
      if (op.type === 'backup' || op.type === 'createFolder') {
        if (!entry.createdId) continue;
        const cur = await getNode(api, entry.createdId);
        if (!cur) throw new Error('missing');
        // Only remove a folder as it was created: renamed, moved or changed means the user kept it.
        if (cur.parentId !== entry.after?.parentId || cur.title !== entry.after?.title) throw new Error('changed');
        if (op.type === 'createFolder') {
          if ((await api.getChildren(entry.createdId)).length) throw new Error('not-empty');
          await api.remove(entry.createdId);
        } else {
          if (entry.after?.count !== undefined && (await countTree(api, entry.createdId)) !== entry.after.count) throw new Error('changed');
          await api.removeTree(entry.createdId);
        }
      } else if (op.type === 'remove') {
        if (!entry.before?.parentId) throw new Error('missing');
        // Never twice: the user may have added the page again since.
        if ((await api.getChildren(entry.before.parentId)).some((c) => c.url === op.expect.url)) throw new Error('exists');
        await api.create({ parentId: entry.before.parentId, index: entry.before.index, title: op.expect.title, url: op.expect.url });
      } else {
        const cur = await getNode(api, op.id);
        if (!cur || !entry.before || !entry.after) throw new Error('missing');
        if (op.type === 'move') {
          if (cur.parentId !== entry.after.parentId) throw new Error('changed');
          await api.move(op.id, { parentId: entry.before.parentId as string, index: entry.before.index });
        } else {
          if (cur.title !== entry.after.title) throw new Error('changed');
          await api.update(op.id, { title: entry.before.title });
        }
      }
      entry.status = 'undone';
      done++;
    } catch (e) {
      skipped.push({ op, reason: e instanceof Error ? e.message : String(e) });
    }
    // Interrupted midway, the next undo checks each change again: one already undone is skipped as "changed".
    if (++sinceSave >= BATCH) {
      sinceSave = 0;
      await store.save(journal);
      onProgress?.(done + skipped.length, entries.length);
    }
  }
  journal.status = 'undone';
  await store.save(journal);
  onProgress?.(entries.length, entries.length);
  return { done, skipped };
}
