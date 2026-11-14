import type { Analysis } from '../analyze';
import { REVIEW_KEY } from '../categorize';
import { type Decisions, type FolderStyle, type NewTree, newTree } from '../plan';
import type { Target } from '../types';

export type NodeKind = 'bar' | 'new' | 'review' | 'existing' | 'dupes' | 'removed';

/** A destination on the canvas: quick access, a folder of the new tree at any depth, or bookmarks left out. */
export interface DestNode {
  /** 'bar', 'review', 'n:<folder key>', 'e:<folder id>', 'dupes' or 'removed'. */
  key: string;
  kind: NodeKind;
  /** Folder of the new tree (folders and To check). */
  folder?: string;
  name: string;
  emoji: string;
  /** Root folder it goes in: the bookmarks bar or Other bookmarks. */
  rootId?: string;
  /** 1 at the top of its root folder. */
  level: number;
  /** Bookmarks right in it. */
  ids: string[];
  /** Bookmarks inside, subfolders included. */
  count: number;
  children: DestNode[];
  /** Made by the user during the review. */
  user: boolean;
  /** How the browser will show a folder's name. */
  style?: FolderStyle;
  /** A folder of an earlier sort, already in the bookmarks: it receives bookmarks and keeps its name and place. */
  existing?: boolean;
}

export interface Layout {
  tree: NewTree;
  /** Root folders of the new tree, the bookmarks bar first, each with the nodes at its top. */
  roots: { rootId: string; nodes: DestNode[] }[];
  /** Bookmarks that are not recreated: duplicates, and those the user removed. */
  out: DestNode[];
  byKey: Map<string, DestNode>;
  /** Node of each bookmark. */
  where: Map<string, string>;
  /** Node above each subfolder. */
  parent: Map<string, string>;
}

export function targetKey(t: Target): string {
  if (t.kind === 'bar') return 'bar';
  if (t.kind === 'new') return nodeKeyOf(t.key);
  return t.kind === 'existing' ? `e:${t.folderId}` : 'stay';
}

export function keyToTarget(key: string): Target {
  if (key === 'bar') return { kind: 'bar' };
  if (key === 'review') return { kind: 'new', key: REVIEW_KEY };
  if (key.startsWith('n:')) return { kind: 'new', key: key.slice(2) };
  if (key.startsWith('e:')) return { kind: 'existing', folderId: key.slice(2) };
  return { kind: 'stay' };
}

/** Node of a folder of the new tree. */
export function nodeKeyOf(folderKey: string): string {
  return folderKey === REVIEW_KEY ? 'review' : `n:${folderKey}`;
}

/** The new tree of a proposal, with the user's changes. */
export function treeOf(an: Analysis, d: Decisions): NewTree {
  const snap = an.snapshot;
  return newTree(an.proposal, d, { barId: snap.barId, defaultRoot: snap.otherId ?? snap.barId ?? '' });
}

/** The new tree as the canvas shows it, computed in one pass: thousands of bookmarks stay fluid. */
export function layout(an: Analysis, d: Decisions): Layout {
  const snap = an.snapshot;
  const tree = treeOf(an, d);
  const byKey = new Map<string, DestNode>();
  const where = new Map<string, string>();
  const parent = new Map<string, string>();
  const folderNode = (key: string): DestNode => {
    const f = tree.byKey.get(key);
    const nodeKey = nodeKeyOf(key);
    const ids = tree.inFolder.get(key) ?? [];
    for (const id of ids) where.set(id, nodeKey);
    const children = (f?.children ?? []).map(folderNode);
    for (const c of children) parent.set(c.key, nodeKey);
    const n: DestNode = {
      key: nodeKey, kind: key === REVIEW_KEY ? 'review' : 'new', folder: key, name: f?.name ?? '', emoji: f?.emoji ?? '', rootId: f?.rootId, level: f?.level ?? 1,
      ids, count: ids.length + children.reduce((s, c) => s + c.count, 0), children, user: !!f?.user, style: f?.style, existing: !!f?.existingId,
    };
    byKey.set(nodeKey, n);
    return n;
  };
  const plain = (key: string, kind: NodeKind, ids: string[], rootId?: string, name = ''): DestNode => {
    for (const id of ids) where.set(id, key);
    const n: DestNode = { key, kind, name, emoji: '', rootId, level: 1, ids, count: ids.length, children: [], user: false };
    byKey.set(key, n);
    return n;
  };
  // Root folder of an existing folder that receives bookmarks right in it.
  const rootOfFolder = (id: string): string => {
    let f = snap.folders.get(id);
    for (let i = 0; f && !f.isRoot && f.parentId && i < 64; i++) f = snap.folders.get(f.parentId);
    return f?.id ?? id;
  };
  const existing = new Map<string, string[]>();
  for (const id of tree.inExisting.keys()) existing.set(rootOfFolder(id), [...(existing.get(rootOfFolder(id)) ?? []), id]);
  const rank = (id: string) => (id === snap.barId ? 0 : id === snap.otherId ? 1 : 2);
  const rootIds = [...new Set([...(snap.barId && tree.bar.length ? [snap.barId] : []), ...tree.tops.keys(), ...existing.keys()])].sort((a, b) => rank(a) - rank(b));
  const roots: Layout['roots'] = [];
  for (const rootId of rootIds) {
    const nodes: DestNode[] = [];
    if (rootId === snap.barId && tree.bar.length) nodes.push(plain('bar', 'bar', tree.bar, rootId));
    for (const k of tree.tops.get(rootId) ?? []) nodes.push(folderNode(k));
    for (const folderId of existing.get(rootId) ?? []) {
      const f = snap.folders.get(folderId);
      nodes.push(plain(`e:${folderId}`, 'existing', tree.inExisting.get(folderId) ?? [], rootId, f && !f.isRoot ? f.title : ''));
    }
    if (nodes.length) roots.push({ rootId, nodes });
  }
  const dupeIds = new Set(an.proposal.duplicates.map((x) => x.bookmarkId));
  const dupes: string[] = [];
  const removed: string[] = [];
  for (const id of an.proposal.candidates) if (tree.place.get(id)?.kind === 'removed') (dupeIds.has(id) ? dupes : removed).push(id);
  const out: DestNode[] = [];
  if (dupes.length) out.push(plain('dupes', 'dupes', dupes));
  if (removed.length) out.push(plain('removed', 'removed', removed));
  return { tree, roots, out, byKey, where, parent };
}

/** Folders of a node and below, in the order of the tree. */
export function flatten(nodes: DestNode[]): DestNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

export interface BarItem {
  /** Bookmark id, or the node key of a folder. */
  id: string;
  folder: boolean;
  url?: string;
  title: string;
  emoji?: string;
  style?: FolderStyle;
}

/** The new bookmarks bar: quick access icons, then the folders created in it. */
export function barPreview(an: Analysis, lay: Layout): BarItem[] {
  const items: BarItem[] = [];
  const bar = lay.roots.find((r) => r.rootId === an.snapshot.barId);
  for (const n of bar?.nodes ?? []) {
    if (n.kind === 'bar') {
      for (const id of n.ids) {
        const b = an.snapshot.bookmarks.get(id);
        items.push({ id, folder: false, url: b?.url, title: b?.title ?? '' });
      }
    } else if (n.kind === 'new' || n.kind === 'review') items.push({ id: n.key, folder: true, title: n.name, emoji: n.emoji, style: n.style });
  }
  return items;
}
