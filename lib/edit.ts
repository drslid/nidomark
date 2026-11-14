/**
 * Changes the user makes to the proposal during the review, kept apart from the screen so they can be tested:
 * folders they create, where a suggestion leads, what their corrections teach, and a new analysis of a folder
 * merged into the tree they are reviewing.
 */
import { REVIEW_KEY } from './categorize';
import { normalizeUrl } from './duplicates';
import type { Decisions, FolderParent, NewTree } from './plan';
import { categoryById, folderRole, groupById, knownSite } from './taxonomy';
import type { Features, NewFolder, Placement, Proposal, ReviewItem, Snapshot, Target } from './types';

export function sameTarget(a: Target | undefined, b: Target | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.kind === 'new' && b.kind === 'new') return a.key === b.key;
  if (a.kind === 'existing' && b.kind === 'existing') return a.folderId === b.folderId;
  return a.kind === b.kind && a.kind !== 'new' && a.kind !== 'existing';
}

/** Bookmarks the user put elsewhere than the proposal did. */
export function userMoves(p: Proposal, d: Decisions): Set<string> {
  const proposed = new Map(p.placements.map((pl) => [pl.bookmarkId, pl.target]));
  const out = new Set<string>();
  for (const [id, m] of Object.entries(d.moves)) if (!sameTarget(m.target, proposed.get(id))) out.add(id);
  return out;
}

/** What a folder name means: a category ("Recettes"), a group ("Loisirs"), or nothing known. */
export function meaningOf(name: string): { vocabId: string | null; groupId?: NewFolder['groupId']; emoji?: string } {
  const role = folderRole(name);
  if (role.kind === 'category') {
    const c = categoryById(role.category);
    return { vocabId: role.category, groupId: c?.group, emoji: c?.emoji };
  }
  if (role.kind === 'group') return { vocabId: null, groupId: role.group, emoji: groupById(role.group).emoji };
  return { vocabId: null };
}

/** A folder the user makes during the review, inside a folder of the new tree or at the top of a root folder. */
export function userFolder(key: string, name: string, parent: FolderParent): NewFolder {
  const m = meaningOf(name);
  return {
    key,
    vocabId: m.vocabId,
    groupId: m.groupId,
    name,
    emoji: m.emoji ?? '📁',
    parentId: 'rootId' in parent ? parent.rootId : '',
    parentKey: 'key' in parent ? parent.key : undefined,
    reason: { key: 'reasonUser' },
  };
}

/** Every bookmark inside a folder of the new tree, its subfolders included. */
export function bookmarksUnder(tree: NewTree, key: string): string[] {
  const f = tree.byKey.get(key);
  if (!f) return [];
  return [...(tree.inFolder.get(key) ?? []), ...f.children.flatMap((c) => bookmarksUnder(tree, c))];
}

/** Folders inside a folder of the new tree, at any depth. */
export function foldersUnder(tree: NewTree, key: string): string[] {
  return (tree.byKey.get(key)?.children ?? []).flatMap((c) => [c, ...foldersUnder(tree, c)]);
}

/** `key` is `ancestor` or a folder inside it: a folder cannot go there. */
export function isWithin(tree: NewTree, key: string, ancestor: string): boolean {
  for (let k: string | undefined = key, i = 0; k && i < 64; k = tree.byKey.get(k)?.parentKey, i++) if (k === ancestor) return true;
  return false;
}

/** Category a folder of the new tree stands for, if any. */
export function categoryOfFolder(tree: NewTree, key: string): string | null {
  return tree.known.get(key)?.vocabId ?? null;
}

export interface Learned {
  urls: Map<string, string>;
  domains: Map<string, string>;
}

/**
 * What the user taught during the review: each bookmark they filed in a folder that stands for a category, and its
 * site with it (sites publishing on every subject and home addresses aside). It comes on top of earlier sorts.
 */
export function sessionLearned(snapshot: Snapshot, features: Map<string, Features>, p: Proposal, d: Decisions, tree: NewTree, base?: Learned): Learned {
  const urls = new Map(base?.urls);
  const domains = new Map(base?.domains);
  for (const id of userMoves(p, d)) {
    const place = tree.place.get(id);
    const category = place?.kind === 'folder' ? categoryOfFolder(tree, place.key) : null;
    const b = snapshot.bookmarks.get(id);
    if (!category || !b) continue;
    urls.set(normalizeUrl(b.url) ?? b.url, category);
    const f = features.get(id);
    if (f?.registrable && !f.privateHost && !knownSite(b.url)?.platform) domains.set(f.registrable, category);
  }
  return { urls, domains };
}

export interface SuggestionTarget {
  category: string;
  /** Folder of the new tree that takes the bookmark. */
  key: string;
  /** Folder to add first, when the tree has none for the category. */
  create?: NewFolder;
  name: string;
  emoji: string;
  /** Names of the folders above it. */
  path: string[];
}

export interface SuggestionContext {
  lang: string;
  /** Root folder of the sorted folders (where a new category folder goes). */
  destinationRoot: string;
  /** Root folder of adult content and dead links. */
  otherRoot: string;
  localName: (x: { id: string; fr: string; en: string }) => string;
}

/**
 * The folder a suggested category leads to: the folder of the tree for it (the user's own first, then the one the
 * proposal made, or the subfolder of the bookmark's site inside it), else a new one, in its group when there is one.
 */
export function suggestionTarget(tree: NewTree, category: string, site: string, ctx: SuggestionContext): SuggestionTarget | null {
  const c = categoryById(category);
  if (!c) return null;
  const pathOf = (key: string) => {
    const names: string[] = [];
    for (let k = tree.byKey.get(key)?.parentKey, i = 0; k && i < 64; k = tree.byKey.get(k)?.parentKey, i++) names.unshift(tree.byKey.get(k)?.name ?? '');
    return names;
  };
  const existing = (key: string): SuggestionTarget => {
    const f = tree.byKey.get(key);
    return { category, key, name: f?.name ?? tree.known.get(key)?.name ?? '', emoji: f?.emoji ?? tree.known.get(key)?.emoji ?? c.emoji, path: pathOf(key) };
  };
  const created = [...tree.byKey.values()];
  const own = created.find((f) => f.user && f.source.vocabId === category);
  if (own) return existing(own.key);
  const facet = site ? tree.byKey.get(`f:${category}:site-${site}`) : undefined;
  if (facet) return existing(facet.key);
  if (tree.byKey.has(`c:${category}`)) return existing(`c:${category}`);
  const kept = created.find((f) => f.source.vocabId === category && f.key.startsWith('k:'));
  if (kept) return existing(kept.key);
  // A folder the user emptied or removed: what is filed there goes where its bookmarks go.
  if (tree.known.has(`c:${category}`)) {
    const into = tree.resolve(`c:${category}`);
    if (into) return existing(into);
  }
  const group = tree.byKey.get(`g:${c.group}`);
  const name = ctx.localName(c);
  const special = c.group === 'adult' || c.group === 'dead';
  // A folder the user deleted with everything above it stays deleted: the suggestion makes a new one, so that what
  // the user moved out of the old one stays where they put it.
  let key = `c:${category}`;
  for (let n = 1; tree.known.has(key); n++) key = n === 1 ? `s:${category}` : `s:${category}:${n}`;
  const create: NewFolder = {
    key,
    vocabId: category,
    groupId: c.group,
    name,
    emoji: c.emoji,
    parentId: group ? '' : special ? ctx.otherRoot : ctx.destinationRoot,
    parentKey: group?.key,
    level: group ? group.level + 1 : 1,
    reason: { key: 'reasonUser' },
  };
  return { category, key, create, name, emoji: c.emoji, path: group ? [...pathOf(group.key), group.name] : [] };
}

/** Files a bookmark where a suggestion leads, making its folder first when the tree has none. */
export function fileAsSuggested(d: Decisions, id: string, s: SuggestionTarget): void {
  // Several bookmarks may lead to the same new folder: it is made once.
  if (s.create && !d.userFolders.some((f) => f.key === s.create?.key)) {
    d.userFolders.push(s.create);
    d.newFolders[s.create.key] = { accepted: true, name: s.name, emoji: s.emoji };
  }
  d.removes[id] = false;
  d.moves[id] = { accepted: true, target: { kind: 'new', key: s.key } };
}

export interface Merge {
  proposal: Proposal;
  /** Where the new analysis files each bookmark it placed. */
  moves: Map<string, Target>;
  /** Bookmarks that change place. */
  changed: string[];
  /** Folders added to the proposal. */
  added: NewFolder[];
}

/**
 * Files the bookmarks of a folder again from a new analysis, inside the tree under review. The folders the tree
 * already has are reused (the user's own folder for a category first); the others are added with the folders above
 * them. A bookmark the new analysis still cannot place stays where it is, with its new reason and suggestions.
 */
export function mergeAnalysis(cur: Proposal, d: Decisions, tree: NewTree, fresh: Proposal, ids: string[]): Merge {
  const freshPlacement = new Map(fresh.placements.map((pl) => [pl.bookmarkId, pl]));
  const freshFolders = new Map(fresh.newFolders.map((f) => [f.key, f]));
  const own = new Map<string, string>();
  for (const f of d.userFolders) if (f.vocabId && d.newFolders[f.key]?.accepted !== false && !own.has(f.vocabId)) own.set(f.vocabId, f.key);
  const freshRoot = (f: NewFolder): string => {
    let x: NewFolder | undefined = f;
    for (let i = 0; x?.parentKey && i < 64; i++) x = freshFolders.get(x.parentKey);
    return x?.parentId ?? '';
  };
  const added: NewFolder[] = [];
  const ensure = (key: string): string | undefined => {
    const f = freshFolders.get(key);
    if (f?.vocabId && key.startsWith('c:') && own.has(f.vocabId)) return own.get(f.vocabId);
    if (tree.known.has(key) || added.some((x) => x.key === key)) return key;
    if (!f) return undefined;
    const parentKey = f.parentKey ? ensure(f.parentKey) : undefined;
    added.push({ ...f, parentKey, parentId: parentKey ? '' : f.parentId || freshRoot(f) });
    return key;
  };
  const placements = new Map(cur.placements.map((pl) => [pl.bookmarkId, pl]));
  const review = new Map(cur.review.map((r) => [r.bookmarkId, r]));
  const suggestions = { ...cur.suggestions };
  const moves = new Map<string, Target>();
  const changed: string[] = [];
  for (const id of ids) {
    const next = freshPlacement.get(id);
    const before = placements.get(id);
    if (!next || !before) continue;
    if (next.target.kind === 'new' && next.target.key === REVIEW_KEY) {
      if (review.has(id)) {
        review.set(id, { bookmarkId: id, reason: next.reason });
        placements.set(id, { ...before, reason: next.reason });
        if (fresh.suggestions[id]) suggestions[id] = fresh.suggestions[id] as string[];
      }
      continue;
    }
    const target: Target = next.target.kind === 'new' ? { kind: 'new', key: ensure(next.target.key) ?? next.target.key } : next.target;
    const now = d.moves[id]?.target ?? before.target;
    if (!sameTarget(now, target)) changed.push(id);
    placements.set(id, { bookmarkId: id, target, reason: next.reason });
    moves.set(id, target);
    review.delete(id);
    delete suggestions[id];
  }
  const proposal: Proposal = {
    ...cur,
    placements: cur.placements.map((pl) => placements.get(pl.bookmarkId) as Placement),
    newFolders: [...cur.newFolders, ...added],
    review: cur.review.flatMap((r) => (review.has(r.bookmarkId) ? [review.get(r.bookmarkId) as ReviewItem] : [])),
    suggestions,
  };
  return { proposal, moves, changed, added };
}
