import { isBackupTitle } from './taxonomy';
import type { NewFolder, Proposal, Target } from './types';

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

/** Where the user put a folder: inside another folder of the new tree, or at the top of a root folder. */
export type FolderParent = { key: string } | { rootId: string };

export interface FolderDecision {
  /** False: the folder is not created; what it holds (bookmarks and subfolders) goes to the folder above it. */
  accepted: boolean;
  name: string;
  emoji: string;
  /** Moved by the user. */
  parent?: FolderParent;
  /** How the browser shows its name, instead of the style chosen for the whole sort. */
  style?: FolderStyle;
}

export interface Decisions {
  moves: Record<string, { accepted: boolean; target: Target }>;
  titles: Record<string, { accepted: boolean; title: string }>;
  newFolders: Record<string, FolderDecision>;
  folderEmojis: Record<string, { accepted: boolean; emoji: string }>;
  iconOnly: Record<string, boolean>;
  /** Bookmarks not recreated (duplicates, or removed by the user): they stay in the archive. */
  removes: Record<string, boolean>;
  folderStyle: FolderStyle;
  /** Folders the user made during the review: created even when empty. */
  userFolders: NewFolder[];
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
  /** A copy of the bookmark `source` in the new tree; the original goes to the archive. */
  | { type: 'createBookmark'; key: string; source: string; parentId?: string; parentKey?: string; title: string; url: string }
  /** `index`: position in the destination (moves into the archive go to 0, last item first, to keep the order). */
  | { type: 'move'; id: string; to: { folderId?: string; newKey?: string; index?: number }; expect: Expected }
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
    userFolders: [],
  };
}

/** A folder of the new tree, where it really goes once the user's changes are applied. */
export interface TreeFolder {
  key: string;
  name: string;
  emoji: string;
  /** Folder above it; none at the top of a root folder. */
  parentKey?: string;
  /** Root folder it is in (bookmarks bar, Other bookmarks). */
  rootId: string;
  /** 1 at the top of the root folder. */
  level: number;
  /** Subfolders created, in order. */
  children: string[];
  /** Made by the user during the review. */
  user: boolean;
  /** How the browser shows its name. */
  style: FolderStyle;
  /** A folder of an earlier sort that receives the bookmarks: it is not created. */
  existingId?: string;
  source: NewFolder;
}

/** Where a bookmark goes: right in the bookmarks bar, in a new folder, right in an existing folder, or nowhere. */
export type Place = { kind: 'bar' } | { kind: 'folder'; key: string } | { kind: 'existing'; folderId: string } | { kind: 'removed' };

export interface NewTree {
  /** Folders created, each after the folder above it, in the order of the browser. */
  folders: TreeFolder[];
  byKey: Map<string, TreeFolder>;
  /** Folders at the top of each root folder, in order. */
  tops: Map<string, string[]>;
  /** Bookmarks right in the bookmarks bar: quick access, in its order. */
  bar: string[];
  /** Bookmarks right in each folder created. */
  inFolder: Map<string, string[]>;
  /** Bookmarks right in an existing folder: a root folder, when no folder above theirs is created. */
  inExisting: Map<string, string[]>;
  place: Map<string, Place>;
  /** Every folder the proposal or the user made, created or not. */
  known: Map<string, NewFolder>;
  /** The folder that receives what is proposed for `key`: itself, or the nearest folder above it that is created. */
  resolve(key: string): string | undefined;
  /** Root folder a folder ends up in. */
  rootOf(key: string): string;
  /** Folders above a folder, nearest first, created or not. */
  above(key: string): string[];
}

export interface TreeContext {
  barId?: string;
  /** Root folder of the folders whose place is unknown: Other bookmarks. */
  defaultRoot: string;
}

/**
 * The new tree as it will be created: the proposal with the user's changes. A folder that is not created hands its
 * bookmarks and subfolders to the folder above it; a folder holding nothing is only created when the user made it.
 */
export function newTree(p: Proposal, d: Decisions, ctx: TreeContext): NewTree {
  const known = new Map<string, NewFolder>();
  for (const f of [...p.newFolders, ...(d.userFolders ?? [])]) if (!known.has(f.key)) known.set(f.key, f);
  const order = new Map([...known.keys()].map((k, i) => [k, i]));
  const userKeys = new Set((d.userFolders ?? []).map((f) => f.key));
  const accepted = (key: string) => d.newFolders[key]?.accepted !== false;
  const proposed = (f: NewFolder): FolderParent => (f.parentKey ? { key: f.parentKey } : { rootId: f.parentId || ctx.defaultRoot });
  const declared = new Map<string, FolderParent>();
  for (const f of known.values()) declared.set(f.key, d.newFolders[f.key]?.parent ?? proposed(f));
  const next = (key: string): string | undefined => {
    const p = declared.get(key);
    return p && 'key' in p && known.has(p.key) ? p.key : undefined;
  };
  // A folder moved below itself makes a loop: the folders of the loop go back where they were proposed.
  for (let changed = true, guard = 0; changed && guard <= known.size; guard++) {
    changed = false;
    for (const key of known.keys()) {
      const seen = new Set<string>();
      let k: string | undefined = key;
      while (k && !seen.has(k)) {
        seen.add(k);
        k = next(k);
      }
      if (!k) continue;
      const loop: string[] = [];
      for (let x: string | undefined = k; x && !loop.includes(x); x = next(x)) loop.push(x);
      const moved = loop.filter((x) => d.newFolders[x]?.parent);
      for (const x of moved) declared.set(x, proposed(known.get(x) as NewFolder));
      if (!moved.length) declared.set(k, { rootId: ctx.defaultRoot });
      changed = true;
    }
  }
  const chains = new Map<string, { up: string[]; rootId: string }>();
  // The folders above a folder, nearest first, up to its root folder.
  const chain = (key: string): { up: string[]; rootId: string } => {
    const hit = chains.get(key);
    if (hit) return hit;
    const up: string[] = [];
    let k = key;
    for (let parent = next(k); parent && up.length <= known.size; parent = next(k)) {
      up.push(parent);
      k = parent;
    }
    const p = declared.get(k);
    const res = { up, rootId: (p && 'rootId' in p ? p.rootId : known.get(k)?.parentId) || ctx.defaultRoot };
    chains.set(key, res);
    return res;
  };
  const resolve = (key: string) => (known.has(key) ? [key, ...chain(key).up].find(accepted) : undefined);
  const rootOf = (key: string) => chain(key).rootId;

  const placement = new Map(p.placements.map((pl) => [pl.bookmarkId, pl.target]));
  const place = new Map<string, Place>();
  const bar: string[] = [];
  const inFolder = new Map<string, string[]>();
  const inExisting = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, id: string) => {
    const list = m.get(k);
    if (list) list.push(id);
    else m.set(k, [id]);
  };
  const toFolder = (id: string, folderId: string) => {
    if (folderId === ctx.barId) {
      bar.push(id);
      place.set(id, { kind: 'bar' });
    } else {
      push(inExisting, folderId, id);
      place.set(id, { kind: 'existing', folderId });
    }
  };
  for (const id of p.candidates) {
    if (d.removes[id]) {
      place.set(id, { kind: 'removed' });
      continue;
    }
    const t = d.moves[id]?.target ?? placement.get(id);
    if (t?.kind === 'bar') toFolder(id, ctx.barId ?? ctx.defaultRoot);
    else if (t?.kind === 'existing') toFolder(id, t.folderId);
    else if (t?.kind === 'new') {
      const k = resolve(t.key);
      if (k) {
        push(inFolder, k, id);
        place.set(id, { kind: 'folder', key: k });
      } else toFolder(id, rootOf(t.key));
    } else toFolder(id, ctx.defaultRoot);
  }
  const rank = new Map(p.quickAccess.map((id, i) => [id, i]));
  bar.sort((a, b) => (rank.get(a) ?? 1e6) - (rank.get(b) ?? 1e6));

  // Folders created: those holding bookmarks, those the user made, and every folder above them.
  const used = new Set<string>();
  const mark = (key: string) => {
    for (const k of [key, ...chain(key).up]) if (accepted(k)) used.add(k);
  };
  for (const k of inFolder.keys()) mark(k);
  for (const k of userKeys) if (accepted(k)) mark(k);
  const sorted = [...used].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  const byKey = new Map<string, TreeFolder>();
  for (const key of sorted) {
    const f = known.get(key) as NewFolder;
    const c = chain(key);
    const above = c.up.filter(accepted);
    const nf = d.newFolders[key];
    const parentKey = above[0];
    // "Emoji only" is for the folders side by side in the bookmarks bar; anywhere else a folder keeps its name.
    const inBar = !parentKey && !!ctx.barId && c.rootId === ctx.barId;
    byKey.set(key, { key, name: nf?.name ?? f.name, emoji: nf?.emoji ?? f.emoji, parentKey, rootId: c.rootId, level: above.length + 1, children: [], user: userKeys.has(key), style: nf?.style ?? (inBar ? d.folderStyle : nestedStyle(d.folderStyle)), existingId: f.existingId, source: f });
  }
  const tops = new Map<string, string[]>();
  for (const key of sorted) {
    const tf = byKey.get(key) as TreeFolder;
    if (tf.parentKey) byKey.get(tf.parentKey)?.children.push(key);
    else push(tops, tf.rootId, key);
  }
  const folders: TreeFolder[] = [];
  const visit = (key: string) => {
    const tf = byKey.get(key);
    if (!tf) return;
    folders.push(tf);
    for (const c of tf.children) visit(c);
  };
  const rootRank = (id: string) => (id === ctx.barId ? 0 : id === ctx.defaultRoot ? 1 : 2);
  for (const r of [...tops.keys()].sort((a, b) => rootRank(a) - rootRank(b))) for (const k of tops.get(r) ?? []) visit(k);
  return { folders, byKey, tops, bar, inFolder, inExisting, place, known, resolve, rootOf, above: (key) => chain(key).up };
}

export interface ArchiveSource {
  /** Key of the folder of the archive that receives these items ("archive:<root id>"). */
  key: string;
  /** Its name: the root folder the items come from ("Bookmarks bar"). */
  title: string;
  /** The items of the previous tree, in their order. */
  items: { id: string; expect: Expected }[];
}

export interface RebuildContext {
  barId?: string;
  node: (id: string) => Expected | undefined;
  archive: { parentId: string; title: string; sources: ArchiveSource[] };
}

/**
 * The whole tree is rebuilt: the new folders are created, every bookmark is recreated in its folder (or at the start
 * of the bookmarks bar for quick access), then the previous tree is moved, as it was, into a dated archive folder.
 */
export function buildRebuildPlan(p: Proposal, d: Decisions, ctx: RebuildContext): Op[] {
  const ops: Op[] = [];
  const tree = newTree(p, d, { barId: ctx.barId, defaultRoot: ctx.archive.parentId });
  const titleOf = (id: string) => {
    const t = d.titles[id];
    return t?.accepted ? t.title : (ctx.node(id)?.title ?? '');
  };
  const create = (id: string, where: { parentId?: string; parentKey?: string }, title: string) => {
    const url = ctx.node(id)?.url;
    if (url) ops.push({ type: 'createBookmark', key: `b:${id}`, source: id, ...where, title, url });
  };
  // Quick access first: created before the folders, the icons come first in the bar once the old tree is archived.
  // Only there can a bookmark show its icon alone: in a folder's menu, the browser shows the address instead.
  for (const id of tree.bar) create(id, { parentId: ctx.barId }, d.iconOnly[id] ? '' : titleOf(id));
  // A folder of an earlier sort is not created again: what goes in it is created right in it.
  const inside = (key: string) => {
    const existing = tree.byKey.get(key)?.existingId;
    return existing ? { parentId: existing } : { parentKey: key };
  };
  for (const f of tree.folders) {
    if (!f.existingId) ops.push({ type: 'createFolder', key: f.key, ...(f.parentKey ? inside(f.parentKey) : { parentId: f.rootId }), title: folderTitle(f.name, f.emoji, f.style) });
  }
  const byTitle = (a: string, b: string) => titleOf(a).localeCompare(titleOf(b));
  for (const f of tree.folders) for (const id of [...(tree.inFolder.get(f.key) ?? [])].sort(byTitle)) create(id, inside(f.key), titleOf(id));
  for (const [parentId, ids] of tree.inExisting) for (const id of [...ids].sort(byTitle)) create(id, { parentId }, titleOf(id));
  const sources = ctx.archive.sources.filter((src) => src.items.length);
  if (sources.length) {
    ops.push({ type: 'createFolder', key: 'archive', parentId: ctx.archive.parentId, title: ctx.archive.title });
    for (const src of sources) ops.push({ type: 'createFolder', key: src.key, parentKey: 'archive', title: src.title });
    for (const src of sources) for (const it of [...src.items].reverse()) ops.push({ type: 'move', id: it.id, to: { newKey: src.key, index: 0 }, expect: it.expect });
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


/** Applies the plan. Each change is journaled before it happens, so that an interruption can always be undone or kept. */
export async function applyPlan(api: BookmarksApi, ops: Op[], store: JournalStore, onProgress?: (done: number, total: number) => void): Promise<RunResult & { journal: Journal }> {
  if (isUnresolved(await store.load())) throw new UnresolvedJournalError();
  const journal: Journal = { id: `run-${Date.now()}`, createdAt: Date.now(), status: 'applying', entries: [] };
  const created = new Map<string, string>();
  const createdIds = new Set<string>();
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
          count += 1 + (await copyTree(api, s.id, folder.id, (n) => n.id === root.id || (n.url === undefined && isBackupTitle(n.title))));
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
        createdIds.add(node.id);
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
    if (op.type === 'createBookmark') {
      // Copies, by batches, in order. In a folder that existed before (the bookmarks bar), its children are noted
      // once per batch: after an interruption, they tell the copies made from the originals with the same name.
      const batch: JournalEntry[] = [];
      const noted = new Set<string>();
      while (i < ops.length && batch.length < BATCH && (ops[i] as Op).type === 'createBookmark') {
        const next = ops[i] as Extract<Op, { type: 'createBookmark' }>;
        const entry: JournalEntry = { op: next, status: 'pending' };
        try {
          const parentId = next.parentKey ? created.get(next.parentKey) : next.parentId;
          if (!parentId) throw new Error('no-folder');
          const source = await getNode(api, next.source);
          if (!source) throw new Error('missing');
          if (source.url !== next.url) throw new Error('changed');
          entry.before = { parentId, title: next.title };
          if (!createdIds.has(parentId) && !noted.has(parentId)) {
            entry.before.siblings = (await api.getChildren(parentId)).map((c) => c.id);
            noted.add(parentId);
          }
          batch.push(entry);
        } catch (e) {
          fail(entry, e);
        }
        journal.entries.push(entry);
        i++;
      }
      await store.save(journal);
      for (const entry of batch) {
        const bop = entry.op as Extract<Op, { type: 'createBookmark' }>;
        try {
          const node = await api.create({ parentId: entry.before?.parentId as string, title: bop.title, url: bop.url });
          entry.createdId = node.id;
          entry.after = { parentId: entry.before?.parentId, title: bop.title };
          entry.status = 'done';
          done++;
        } catch (e) {
          fail(entry, e);
        }
      }
      await store.save(journal);
      progress();
      continue;
    }
    // Moves, removals and renames, by batches: check every precondition, journal the batch, then change.
    const batch: { entry: JournalEntry; target?: string }[] = [];
    while (i < ops.length && batch.length < BATCH) {
      const next = ops[i] as Op;
      if (next.type !== 'move' && next.type !== 'rename' && next.type !== 'remove') break;
      const id = next.id;
      const entry: JournalEntry = { op: next, status: 'pending' };
      try {
        const cur = await getNode(api, id);
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
        const dest = bop.type === 'move' ? (bop.to.index === undefined ? { parentId: target as string } : { parentId: target as string, index: bop.to.index }) : undefined;
        const res = asNode(bop.type === 'move' ? await api.move(bop.id, dest as { parentId: string; index?: number }) : await api.update(bop.id, { title: bop.title }));
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
  const createdFolders = new Set<string>();
  // Children of the folders that existed before, as noted before each batch of copies.
  const noted = new Map<string, Set<string>>();
  const claimed = new Set(journal.entries.flatMap((e) => (e.createdId ? [e.createdId] : [])));
  for (const entry of journal.entries) {
    const { op } = entry;
    if (op.type === 'createBookmark' && entry.before?.siblings && entry.before.parentId) noted.set(entry.before.parentId, new Set(entry.before.siblings));
    if (entry.status === 'pending' && op.type === 'createBookmark') {
      const parentId = entry.before?.parentId;
      const before = parentId && createdFolders.has(parentId) ? new Set<string>() : parentId ? noted.get(parentId) : undefined;
      const children = parentId && before ? await api.getChildren(parentId).catch(() => [] as NodeView[]) : [];
      const copy = children.find((c) => before && !before.has(c.id) && !claimed.has(c.id) && c.id !== op.source && c.url === op.url && c.title === op.title);
      if (copy) {
        claimed.add(copy.id);
        entry.createdId = copy.id;
        entry.after = { parentId, title: op.title };
        entry.status = 'done';
      } else entry.status = 'failed';
      continue;
    }
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
      } else if (op.type === 'move' || op.type === 'rename') {
        const cur = await getNode(api, op.id);
        const target = op.type === 'move' ? (op.to.folderId ?? createdByKey.get(op.to.newKey ?? '')) : undefined;
        const happened = !!cur && (op.type === 'move' ? cur.parentId === target : cur.title === op.title && cur.title !== entry.before?.title);
        if (cur && happened) {
          entry.after = snap(cur);
          entry.status = 'done';
        } else entry.status = 'failed';
      }
    }
    if (op.type === 'createFolder' && entry.createdId && entry.status === 'done') {
      createdByKey.set(op.key, entry.createdId);
      createdFolders.add(entry.createdId);
    }
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
      } else if (op.type === 'createBookmark') {
        if (!entry.createdId) continue;
        const cur = await getNode(api, entry.createdId);
        if (!cur) throw new Error('missing');
        if (cur.url !== op.url || cur.title !== entry.after?.title || cur.parentId !== entry.after?.parentId) throw new Error('changed');
        // The copy goes only while its original exists: if the archive was deleted, the copy is all that is left.
        const source = await getNode(api, op.source);
        if (!source || source.url !== op.url) throw new Error('no-original');
        await api.remove(entry.createdId);
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
