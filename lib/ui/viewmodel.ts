import type { Analysis } from '../analyze';
import { REVIEW_KEY } from '../categorize';
import { type Decisions, folderResolver } from '../plan';
import type { Target } from '../types';

export type NodeKind = 'bar' | 'new' | 'review' | 'dupes';

/** A subfolder of a node, shown as a section of its sheet. */
export interface Section {
  key: string;
  name: string;
  emoji: string;
  /** 2 or 3. */
  level: number;
  /** Bookmarks proposed for this folder, or moved there by the user. */
  ids: string[];
  /** The user chose not to create it (or a folder above it): its bookmarks go to `into`. */
  off: boolean;
  into?: string;
}

/** A destination on the canvas: quick access, a folder at the top of the new tree, or duplicates left out. */
export interface DestNode {
  /** 'bar', 'n:<new folder key>', 'review' or 'dupes'. */
  key: string;
  kind: NodeKind;
  name: string;
  emoji: string;
  /** Root folder it goes in: the bookmarks bar or Other bookmarks. */
  rootId?: string;
  /** Bookmarks right in this folder. */
  ids: string[];
  /** Every bookmark inside, subfolders included. */
  all: string[];
  sections: Section[];
}

export interface Layout {
  nodes: DestNode[];
  /** Node of each bookmark, and the folder it is proposed for. */
  where: Map<string, { node: string; folder?: string }>;
}

export function targetKey(t: Target): string {
  if (t.kind === 'bar') return 'bar';
  if (t.kind === 'new') return t.key === REVIEW_KEY ? 'review' : `n:${t.key}`;
  return t.kind === 'existing' ? `e:${t.folderId}` : 'stay';
}

export function keyToTarget(key: string): Target {
  if (key === 'bar') return { kind: 'bar' };
  if (key === 'review') return { kind: 'new', key: REVIEW_KEY };
  if (key.startsWith('n:')) return { kind: 'new', key: key.slice(2) };
  if (key.startsWith('e:')) return { kind: 'existing', folderId: key.slice(2) };
  return { kind: 'stay' };
}

/** Quick access in the order of the bar: most visited first, then the bookmarks the user added. */
function quickOrder(an: Analysis, ids: string[]): string[] {
  const rank = new Map(an.proposal.quickAccess.map((id, i) => [id, i]));
  return [...ids].sort((a, b) => (rank.get(a) ?? 1e6) - (rank.get(b) ?? 1e6));
}

/** The new tree as the canvas shows it, computed in one pass: thousands of bookmarks stay fluid. */
export function layout(an: Analysis, d: Decisions): Layout {
  const p = an.proposal;
  const byKey = new Map(p.newFolders.map((f) => [f.key, f]));
  const placement = new Map(p.placements.map((pl) => [pl.bookmarkId, pl.target]));
  const topOf = (key: string) => {
    let f = byKey.get(key);
    for (let i = 0; f?.parentKey && i < 8; i++) f = byKey.get(f.parentKey);
    return f;
  };
  const where = new Map<string, { node: string; folder?: string }>();
  const bar: string[] = [];
  const dupes: string[] = [];
  const inFolder = new Map<string, string[]>();
  for (const id of p.candidates) {
    if (d.removes[id]) {
      dupes.push(id);
      where.set(id, { node: 'dupes' });
      continue;
    }
    const target = d.moves[id]?.target ?? placement.get(id);
    if (target?.kind === 'bar') {
      bar.push(id);
      where.set(id, { node: 'bar' });
    } else if (target?.kind === 'new' && byKey.has(target.key)) {
      const list = inFolder.get(target.key);
      if (list) list.push(id);
      else inFolder.set(target.key, [id]);
      where.set(id, { node: targetKey({ kind: 'new', key: topOf(target.key)?.key ?? target.key }), folder: target.key });
    }
  }
  const resolve = folderResolver(p, d);
  const nameOf = (key: string) => d.newFolders[key]?.name ?? byKey.get(key)?.name ?? '';
  // A section shows when it or a folder below it holds bookmarks: "Tech › Dev" heads its "GitHub" subfolder.
  const filled = new Set<string>();
  for (const [key, ids] of inFolder) if (ids.length) for (let k: string | undefined = key; k && !filled.has(k); k = byKey.get(k)?.parentKey) filled.add(k);
  const nodes: DestNode[] = [];
  if (bar.length) nodes.push({ key: 'bar', kind: 'bar', name: '', emoji: '', rootId: an.snapshot.barId, ids: quickOrder(an, bar), all: quickOrder(an, bar), sections: [] });
  const folders: DestNode[] = [];
  for (const f of p.newFolders) {
    if (f.parentKey) continue;
    const user = f.key.startsWith('user-');
    if (!filled.has(f.key) && !user) continue;
    const ids = inFolder.get(f.key) ?? [];
    const all = [...ids];
    const sections: Section[] = [];
    for (const sub of p.newFolders) {
      if (!sub.parentKey || topOf(sub.key)?.key !== f.key || !filled.has(sub.key)) continue;
      const subIds = inFolder.get(sub.key) ?? [];
      const into = resolve(sub.key);
      sections.push({ key: sub.key, name: nameOf(sub.key), emoji: d.newFolders[sub.key]?.emoji ?? sub.emoji, level: sub.level ?? 2, ids: subIds, off: into !== sub.key, into: into && into !== sub.key ? nameOf(into) : undefined });
      all.push(...subIds);
    }
    folders.push({ key: targetKey({ kind: 'new', key: f.key }), kind: f.key === REVIEW_KEY ? 'review' : 'new', name: nameOf(f.key), emoji: d.newFolders[f.key]?.emoji ?? f.emoji, rootId: f.parentId, ids, all, sections });
  }
  // Folders of the bookmarks bar first, as in the browser, then those of Other bookmarks.
  const barId = an.snapshot.barId;
  nodes.push(...folders.filter((n) => n.rootId === barId), ...folders.filter((n) => n.rootId !== barId));
  if (dupes.length) nodes.push({ key: 'dupes', kind: 'dupes', name: '', emoji: '', ids: dupes, all: dupes, sections: [] });
  return { nodes, where };
}

export interface BarItem {
  /** Bookmark id, or the node key of a folder. */
  id: string;
  folder: boolean;
  url?: string;
  title: string;
  emoji?: string;
}

/** The new bookmarks bar: quick access icons, then the folders created in it. */
export function barPreview(an: Analysis, lay: Layout): BarItem[] {
  const items: BarItem[] = [];
  for (const id of lay.nodes.find((n) => n.kind === 'bar')?.ids ?? []) {
    const b = an.snapshot.bookmarks.get(id);
    items.push({ id, folder: false, url: b?.url, title: b?.title ?? '' });
  }
  for (const n of lay.nodes) if (n.kind !== 'bar' && n.kind !== 'dupes' && n.rootId === an.snapshot.barId) items.push({ id: n.key, folder: true, title: n.name, emoji: n.emoji });
  return items;
}
