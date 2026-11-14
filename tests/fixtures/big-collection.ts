import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CategorizeOptions, categorize } from '../../lib/categorize';
import { exampleVectors } from '../../lib/examples';
import { prepare, splitVectors } from '../../lib/pipeline';
import { loadPublicSuffixList } from '../../lib/psl';
import { buildSnapshot, type TreeNode } from '../../lib/snapshot';
import { categoryById } from '../../lib/taxonomy';
import { fold, nameKey } from '../../lib/text';
import type { Proposal, Snapshot } from '../../lib/types';

/** A bookmark of the large collection, with where it belongs: its subject category, or "review". */
export interface BigBookmark {
  id: string;
  /** Folder holding it: "Barre" (bookmarks bar) or "Autres" (other bookmarks), then subfolders, joined with "/". */
  folder: string;
  title: string;
  url: string;
  expect: string;
  /** A personal project folder ("Japon 2023") it should stay in. */
  project?: string;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BIG_VECTORS = path.join(HERE, 'big', 'vectors.json');
loadPublicSuffixList(fs.readFileSync(path.join(HERE, '..', '..', 'lib', 'data', 'public_suffix_list.dat'), 'utf8'));

/** A large, messy collection of a French user, written by hand for the evaluation (illustrative data). */
export const BIG = JSON.parse(fs.readFileSync(path.join(HERE, 'big', 'collection.json'), 'utf8')) as { policy: string; bookmarks: BigBookmark[] };

/** Chrome-like bookmarks tree of the large collection. */
export function bigTree(): TreeNode[] {
  const roots: Record<string, TreeNode> = {
    Barre: { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [] },
    Autres: { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [] },
  };
  const folders = new Map<string, TreeNode>();
  const add = (parent: TreeNode, node: TreeNode) => {
    const children = parent.children as TreeNode[];
    children.push({ ...node, parentId: parent.id, index: children.length });
    return children[children.length - 1] as TreeNode;
  };
  const folderFor = (p: string): TreeNode => {
    const root = roots[p];
    if (root) return root;
    const known = folders.get(p);
    if (known) return known;
    const cut = p.lastIndexOf('/');
    const f = add(folderFor(p.slice(0, cut)), { id: `F:${p}`, title: p.slice(cut + 1), children: [] });
    folders.set(p, f);
    return f;
  };
  for (const b of BIG.bookmarks) add(folderFor(b.folder), { id: b.id, title: b.title, url: b.url });
  return [{ id: '0', title: '', children: [roots.Barre as TreeNode, roots.Autres as TreeNode] }];
}

/** Vectors of the texts, stored on 8 bits with a scale per vector (like lib/data/example-vectors.ts). */
export type StoredVectors = Record<string, [scale: number, int8: string]>;

export function readBigVectors(): StoredVectors {
  return fs.existsSync(BIG_VECTORS) ? (JSON.parse(fs.readFileSync(BIG_VECTORS, 'utf8')) as { vectors: StoredVectors }).vectors : {};
}

export function packVector(v: Float32Array): [number, string] {
  const scale = Math.max(...v.map(Math.abs)) || 1;
  return [Number(scale.toFixed(6)), Buffer.from(Int8Array.from(v, (x) => Math.round((x / scale) * 127)).buffer).toString('base64')];
}

function unpackVector([scale, b64]: [number, string]): Float32Array {
  const raw = new Int8Array(Buffer.from(b64, 'base64'));
  const v = Float32Array.from(raw, (q) => (q / 127) * scale);
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
}

/** The texts the extension embeds for the large collection. */
export function bigTexts(lang = 'fr'): string[] {
  return prepare(buildSnapshot(bigTree(), 1), undefined, ['1', '2'], lang).texts;
}

/** Sorts the large collection as the extension does (French, titles only, no history), with the stored vectors. */
export function sortBig(options?: Partial<CategorizeOptions>, lang = 'fr'): { proposal: Proposal; snapshot: Snapshot; ms: number } {
  const snapshot = buildSnapshot(bigTree(), 1);
  const p = prepare(snapshot, undefined, ['1', '2'], lang);
  const stored = readBigVectors();
  const vectorOf = (t: string) => {
    const v = stored[t];
    if (!v) throw new Error(`No vector for "${t}": run \`pnpm eval:big\``);
    return unpackVector(v);
  };
  const t0 = performance.now();
  const { proposal } = categorize({
    snapshot, features: p.features, candidates: p.candidates, ...splitVectors(p, p.texts.map(vectorOf)), labeled: exampleVectors(),
    pageVectors: new Map(), sites: new Map(), duplicates: p.duplicates, siteReading: false, known: new Map(), destination: 'bar', lang, options,
  });
  return { proposal, snapshot, ms: performance.now() - t0 };
}

export interface BigScore {
  /** Bookmarks filed under their subject (quick access aside). */
  ok: number;
  total: number;
  wrong: string[];
  /** Folders with the same name under one parent, and folders inside a folder of the same name. */
  twins: string[];
  nested: string[];
  /** Names given to folders in several places. */
  repeated: string[];
  /** Subjects found in more than one place, with their places. */
  scattered: { category: string; places: [string, number][] }[];
  /** Places per subject, on average. */
  placesPerSubject: number;
  subjects: number;
}

/** What a user would see: bookmarks under their subject, each subject in one place, no folder twice. */
export function scoreBig(proposal: Proposal): BigScore {
  const byKey = new Map(proposal.newFolders.map((f) => [f.key, f]));
  const where = new Map(proposal.placements.map((pl) => [pl.bookmarkId, pl.target]));
  const dupes = new Set(proposal.duplicates.map((d) => d.bookmarkId));
  const pathOf = (key: string): string[] => {
    const f = byKey.get(key);
    return f ? [...(f.parentKey ? pathOf(f.parentKey) : []), f.name] : [key];
  };
  const up = (key: string | undefined, pick: (k: string) => string | null | undefined): string | null => {
    for (let k = key, i = 0; k && i < 8; k = byKey.get(k)?.parentKey, i++) {
      const found = pick(k);
      if (found) return found;
    }
    return null;
  };
  // The place of a subject: the nearest category or group folder above (a subfolder inside a category is still its
  // place), else the outermost folder of its own (a project in "My folders", "To check").
  const homeOf = (key: string): string => {
    let outer = key;
    for (let k: string | undefined = key, i = 0; k && i < 8; k = byKey.get(k)?.parentKey, i++) {
      if (k.startsWith('c:') || k.startsWith('g:') || byKey.get(k)?.parentKey === 'mine') return pathOf(k).join(' › ');
      outer = byKey.get(k)?.parentKey ?? k;
    }
    return pathOf(outer).join(' › ');
  };
  let ok = 0;
  let total = 0;
  const wrong: string[] = [];
  const homes = new Map<string, Map<string, number>>();
  for (const b of BIG.bookmarks) {
    const target = where.get(b.id);
    // Quick access holds the most visited sites on purpose, whatever their subject; a copy stays in the backup.
    if (dupes.has(b.id) || !target || target.kind === 'bar') continue;
    const key = target.kind === 'new' ? target.key : target.kind;
    const place = target.kind === 'new' ? pathOf(target.key).join(' › ') : `(${target.kind})`;
    if (b.expect !== 'review') {
      const m = homes.get(b.expect) ?? new Map<string, number>();
      const home = target.kind === 'new' ? homeOf(target.key) : place;
      m.set(home, (m.get(home) ?? 0) + 1);
      homes.set(b.expect, m);
    }
    total++;
    const cat = target.kind === 'new' ? up(target.key, (k) => byKey.get(k)?.vocabId) : null;
    const grp = target.kind === 'new' ? up(target.key, (k) => byKey.get(k)?.groupId) : null;
    const inProject = !!b.project && target.kind === 'new' && pathOf(target.key).some((n) => fold(n) === fold(b.project as string));
    const good = b.expect === 'review' ? key === 'review' : cat === b.expect || inProject || (!cat && grp === categoryById(b.expect)?.group);
    if (good) ok++;
    else wrong.push(`✗ ${b.id.padEnd(5)} ${b.title.slice(0, 58).padEnd(59)} → ${place.padEnd(40)} expected ${b.expect}${b.project ? ` (${b.project})` : ''} · ${b.folder}`);
  }
  const slots = new Map<string, string[]>();
  for (const f of proposal.newFolders) {
    const slot = `${f.parentKey ?? `root:${f.parentId}`}|${nameKey(f.name)}`;
    slots.set(slot, [...(slots.get(slot) ?? []), pathOf(f.key).join(' › ')]);
  }
  const names = new Map<string, string[]>();
  for (const f of proposal.newFolders) names.set(nameKey(f.name), [...(names.get(nameKey(f.name)) ?? []), pathOf(f.key).join(' › ')]);
  return {
    ok,
    total,
    wrong,
    twins: [...slots.values()].filter((ps) => ps.length > 1).map((ps) => ps.join(' = ')),
    nested: proposal.newFolders.filter((f) => f.parentKey && nameKey(byKey.get(f.parentKey)?.name ?? '') === nameKey(f.name)).map((f) => pathOf(f.key).join(' › ')),
    repeated: [...names.values()].filter((ps) => ps.length > 1).map((ps) => ps.join(' | ')),
    scattered: [...homes.entries()].filter(([, m]) => m.size > 1).map(([category, m]) => ({ category, places: [...m.entries()].sort((a, b) => b[1] - a[1]) })).sort((a, b) => b.places.length - a.places.length),
    placesPerSubject: [...homes.values()].reduce((s, m) => s + m.size, 0) / Math.max(1, homes.size),
    subjects: homes.size,
  };
}
