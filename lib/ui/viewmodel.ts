import type { Analysis } from '../analyze';
import type { Decisions } from '../plan';
import type { FolderItem, Target } from '../types';
import { leadingEmoji, stripEmoji } from '../vocab';

export type NodeKind = 'new' | 'existing' | 'review' | 'stay';

/** A destination on the canvas: a proposed folder, an existing folder, "to check" or "stays in place". */
export interface DestNode {
  /** 'n:<new folder key>', 'e:<folder id>', 'review' or 'stay'. */
  key: string;
  kind: NodeKind;
  name: string;
  emoji: string;
  folder?: FolderItem;
  /** Bookmarks shown in this node, in the order of the source folder. */
  ids: string[];
  /** A proposed folder the user chose not to create. */
  off: boolean;
}

export function targetKey(t: Target): string {
  return t.kind === 'existing' ? `e:${t.folderId}` : t.kind === 'new' ? `n:${t.key}` : 'stay';
}

export function keyToTarget(key: string): Target {
  if (key.startsWith('e:')) return { kind: 'existing', folderId: key.slice(2) };
  if (key.startsWith('n:')) return { kind: 'new', key: key.slice(2) };
  return { kind: 'stay' };
}

/** Bookmarks the proposal decided about, in the order of their source folders. */
export function candidateIds(an: Analysis): string[] {
  const decided = new Set([...an.proposal.placements.map((p) => p.bookmarkId), ...an.proposal.review.map((r) => r.bookmarkId)]);
  return an.sourceFolderIds.flatMap((fid) => an.snapshot.folders.get(fid)?.bookmarkIds ?? []).filter((id) => decided.has(id));
}

/** Where a bookmark ends up with the current decisions. */
export function nodeOf(an: Analysis, d: Decisions, id: string): string {
  const m = d.moves[id];
  if (m?.accepted && m.target.kind === 'existing') return targetKey(m.target);
  if (m?.accepted && m.target.kind === 'new' && d.newFolders[m.target.key]?.accepted) return targetKey(m.target);
  return an.proposal.review.some((r) => r.bookmarkId === id) ? 'review' : 'stay';
}

export function folderEmoji(d: Decisions, f: FolderItem): string {
  const fe = d.folderEmojis[f.id];
  return fe?.accepted ? fe.emoji : (leadingEmoji(f.title) ?? '');
}

/** Canvas nodes: new folders, then existing folders (largest first), declined folders, "to check", "stays". */
export function destinations(an: Analysis, d: Decisions): DestNode[] {
  const ids = candidateIds(an);
  const where = new Map(ids.map((id) => [id, nodeOf(an, d, id)]));
  const by = (key: string) => ids.filter((id) => where.get(id) === key);
  const nodes: DestNode[] = [];
  for (const f of an.proposal.newFolders) {
    const nf = d.newFolders[f.key];
    if (!nf) continue;
    const off = !nf.accepted;
    const members = off ? ids.filter((id) => d.moves[id]?.accepted && d.moves[id]?.target.kind === 'new' && (d.moves[id]?.target as { key: string }).key === f.key) : by(`n:${f.key}`);
    if (!members.length && !f.key.startsWith('user-')) continue;
    nodes.push({ key: `n:${f.key}`, kind: 'new', name: nf.name, emoji: nf.emoji, ids: members, off });
  }
  const existing = new Set([...where.values()].filter((k) => k.startsWith('e:')));
  for (const key of existing) {
    const f = an.snapshot.folders.get(key.slice(2));
    if (f) nodes.push({ key, kind: 'existing', name: stripEmoji(f.title) || f.title, emoji: folderEmoji(d, f), folder: f, ids: by(key), off: false });
  }
  nodes.sort((a, b) => Number(a.off) - Number(b.off) || Number(a.kind === 'existing') - Number(b.kind === 'existing') || b.ids.length - a.ids.length);
  const review = by('review');
  if (review.length) nodes.push({ key: 'review', kind: 'review', name: '', emoji: '', ids: review, off: false });
  const stay = by('stay');
  if (stay.length) nodes.push({ key: 'stay', kind: 'stay', name: '', emoji: '', ids: stay, off: false });
  return nodes;
}

export interface BarItem {
  id: string;
  folder: boolean;
  url?: string;
  title: string;
}

/** Items of the bookmarks bar, in order. */
export function barItems(an: Analysis): BarItem[] {
  const bar = an.snapshot.barId ? an.snapshot.folders.get(an.snapshot.barId) : undefined;
  if (!bar) return [];
  const items = [
    ...bar.bookmarkIds.map((id) => {
      const b = an.snapshot.bookmarks.get(id);
      return { id, index: b?.index ?? 0, folder: false, url: b?.url, title: b?.title ?? '' };
    }),
    ...bar.folderIds.map((id) => {
      const f = an.snapshot.folders.get(id);
      return { id, index: f?.index ?? 0, folder: true, title: f?.title ?? '' };
    }),
  ];
  return items.sort((a, b) => a.index - b.index).map(({ index: _index, ...rest }) => rest);
}
