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
}

export type FolderStyle = 'name' | 'emoji-name' | 'emoji';

export interface Decisions {
  moves: Record<string, { accepted: boolean; target: Target }>;
  titles: Record<string, { accepted: boolean; title: string }>;
  newFolders: Record<string, { accepted: boolean; name: string; emoji: string }>;
  folderEmojis: Record<string, { accepted: boolean; emoji: string }>;
  iconOnly: Record<string, boolean>;
  folderStyle: FolderStyle;
}

/** State a node must still have for an operation to apply: anything else means the user changed it meanwhile. */
export interface Expected {
  parentId?: string;
  title: string;
  url?: string;
}

export type Op =
  | { type: 'createFolder'; key: string; parentId: string; title: string }
  | { type: 'move'; id: string; to: { folderId?: string; newKey?: string }; expect: Expected }
  | { type: 'rename'; id: string; title: string; expect: Expected; iconOnly?: boolean };

export function folderTitle(name: string, emoji: string, style: FolderStyle): string {
  if (style === 'emoji' && emoji) return emoji;
  if (style === 'emoji-name' && emoji) return `${emoji} ${name}`;
  return name;
}

/** Default decisions: every proposed change is accepted, icon-only applied to the given bar bookmarks. */
export function defaultDecisions(p: Proposal, style: FolderStyle, iconOnlyIds: string[] = []): Decisions {
  return {
    moves: Object.fromEntries(p.placements.filter((pl) => pl.target.kind !== 'stay').map((pl) => [pl.bookmarkId, { accepted: true, target: pl.target }])),
    titles: Object.fromEntries(Object.entries(p.titles).map(([id, title]) => [id, { accepted: true, title }])),
    newFolders: Object.fromEntries(p.newFolders.map((f) => [f.key, { accepted: true, name: f.name, emoji: f.emoji }])),
    folderEmojis: Object.fromEntries(Object.entries(p.folderEmojis).map(([id, emoji]) => [id, { accepted: style !== 'name', emoji }])),
    iconOnly: Object.fromEntries(iconOnlyIds.map((id) => [id, true])),
    folderStyle: style,
  };
}

/** Current state of the nodes, as known when the plan is built. */
export interface Current {
  node: (id: string) => Expected | undefined;
}

/** Ordered operations: create folders, move bookmarks, then rename. Nothing is ever deleted. */
export function buildPlan(p: Proposal, d: Decisions, current: Current): Op[] {
  const ops: Op[] = [];
  const usedKeys = new Set(Object.entries(d.moves).filter(([, m]) => m.accepted && m.target.kind === 'new').map(([, m]) => (m.target as { key: string }).key));
  for (const f of p.newFolders) {
    const nf = d.newFolders[f.key];
    if (!nf?.accepted || !usedKeys.has(f.key)) continue;
    ops.push({ type: 'createFolder', key: f.key, parentId: f.parentId, title: folderTitle(nf.name, nf.emoji, d.folderStyle) });
  }
  for (const [id, m] of Object.entries(d.moves)) {
    if (!m.accepted || m.target.kind === 'stay') continue;
    if (m.target.kind === 'new' && !d.newFolders[m.target.key]?.accepted) continue;
    const cur = current.node(id);
    if (!cur) continue;
    const to = m.target.kind === 'existing' ? { folderId: m.target.folderId } : { newKey: m.target.key };
    if (to.folderId === cur.parentId) continue;
    ops.push({ type: 'move', id, to, expect: cur });
  }
  for (const [id, t] of Object.entries(d.titles)) {
    const cur = current.node(id);
    if (!t.accepted || !cur || d.iconOnly[id] || t.title === cur.title) continue;
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
      const next = folderTitle(cur.title, fe.emoji, d.folderStyle);
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

/** Applies the plan. Each entry is saved before its change, so that an interruption can always be undone or kept. */
export async function applyPlan(api: BookmarksApi, ops: Op[], store: JournalStore, onProgress?: (done: number, total: number) => void): Promise<RunResult & { journal: Journal }> {
  if (isUnresolved(await store.load())) throw new UnresolvedJournalError();
  const journal: Journal = { id: `run-${Date.now()}`, createdAt: Date.now(), status: 'applying', entries: [] };
  const created = new Map<string, string>();
  const skipped: RunResult['skipped'] = [];
  let done = 0;
  await store.save(journal);
  for (const op of ops) {
    const entry: JournalEntry = { op, status: 'pending' };
    let target: string | undefined;
    // 1. Preconditions: never touch a node the user changed since the analysis.
    try {
      if (op.type === 'createFolder') {
        entry.before = { parentId: op.parentId, title: op.title, siblings: (await api.getChildren(op.parentId)).map((c) => c.id) };
      } else {
        const cur = await getNode(api, op.id);
        if (!cur) throw new Error('missing');
        if (!sameAsExpected(cur, op.expect, op.type === 'move')) throw new Error('changed');
        if (op.type === 'move') {
          target = op.to.folderId ?? created.get(op.to.newKey ?? '');
          if (!target) throw new Error('no-folder');
        }
        entry.before = snap(cur);
      }
    } catch (e) {
      entry.status = 'failed';
      entry.error = e instanceof Error ? e.message : String(e);
      journal.entries.push(entry);
      skipped.push({ op, reason: entry.error });
      await store.save(journal);
      onProgress?.(done + skipped.length, ops.length);
      continue;
    }
    // 2. Write-ahead: the entry is stored before the change.
    journal.entries.push(entry);
    await store.save(journal);
    // 3. The change itself.
    try {
      if (op.type === 'createFolder') {
        const node = await api.create({ parentId: op.parentId, title: op.title });
        created.set(op.key, node.id);
        entry.createdId = node.id;
        entry.after = { parentId: op.parentId, title: op.title };
      } else {
        const res = asNode(op.type === 'move' ? await api.move(op.id, { parentId: target as string }) : await api.update(op.id, { title: op.title }));
        const after = res ?? (await getNode(api, op.id));
        entry.after = after ? snap(after) : { parentId: op.type === 'move' ? target : entry.before?.parentId, title: op.type === 'rename' ? op.title : (entry.before?.title ?? '') };
      }
      entry.status = 'done';
      done++;
    } catch (e) {
      entry.status = 'failed';
      entry.error = e instanceof Error ? e.message : String(e);
      skipped.push({ op, reason: entry.error });
    }
    await store.save(journal);
    onProgress?.(done + skipped.length, ops.length);
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
      if (op.type === 'createFolder') {
        const before = new Set(entry.before?.siblings ?? []);
        const children = await api.getChildren(op.parentId).catch(() => [] as NodeView[]);
        const found = children.find((c) => !before.has(c.id) && c.url === undefined && c.title === op.title);
        if (found) {
          entry.createdId = found.id;
          entry.after = { parentId: op.parentId, title: op.title };
          entry.status = 'done';
        } else entry.status = 'failed';
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
export async function undoLast(api: BookmarksApi, store: JournalStore): Promise<RunResult> {
  const journal = await store.load();
  if (!journal || journal.status === 'undone') return { done: 0, skipped: [] };
  await reconcile(api, journal);
  journal.status = 'undoing';
  await store.save(journal);
  const skipped: RunResult['skipped'] = [];
  let done = 0;
  for (const entry of [...journal.entries].reverse()) {
    if (entry.status !== 'done') continue;
    const { op } = entry;
    try {
      if (op.type === 'createFolder') {
        if (!entry.createdId) continue;
        const cur = await getNode(api, entry.createdId);
        if (!cur) throw new Error('missing');
        // Only remove the folder as it was created: renamed, moved or not empty means the user kept it.
        if (cur.parentId !== entry.after?.parentId || cur.title !== entry.after?.title) throw new Error('changed');
        if ((await api.getChildren(entry.createdId)).length) throw new Error('not-empty');
        await api.remove(entry.createdId);
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
    await store.save(journal);
  }
  journal.status = 'undone';
  await store.save(journal);
  return { done, skipped };
}
