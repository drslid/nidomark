import type { Features, FolderItem, NewFolder, Placement, Proposal, Reason, ReviewItem, Snapshot, Usage } from './types';
import { USAGES } from './types';
import { type SparseVector, sparseDot, tfidf } from './text';
import { type VocabEntry, allKnownAppsIn, leadingEmoji, stripEmoji, usageOfFolderTitle, vocabForTitle, vocabName } from './vocab';

export interface ClassifyOptions {
  /** Smallest group that becomes a new folder. */
  minGroupSize: number;
  /** Affinity (standard deviations above the collection's average) needed to join an existing folder… */
  zAssign: number;
  /** …with this lead over the second best folder. */
  zMargin: number;
  /** Average-linkage threshold for new groups. */
  zLink: number;
  /** Weight of keyword similarity against the model's similarity. */
  wKw: number;
  /** Bonus for two bookmarks clearly about the same subject label. */
  wLab: number;
  /** Similarity needed to follow a bookmark the user filed himself. */
  knnZ: number;
  /** Bookmarks beyond this number are not grouped into new folders (cost is quadratic). */
  maxClusterItems: number;
}

export const DEFAULT_OPTIONS: ClassifyOptions = {
  minGroupSize: 3, zAssign: 1.2, zMargin: 0.3, zLink: 1.4, wKw: 1.0, wLab: 1.0, knnZ: 1.5, maxClusterItems: 600,
};

export interface ClassifyInput {
  snapshot: Snapshot;
  features: Map<string, Features>;
  vectors: Map<string, Float32Array>;
  usageVectors: Record<Usage, Float32Array>;
  labels: { entry: VocabEntry; vector: Float32Array }[];
  folderVectors?: Map<string, Float32Array>;
  /** Folders whose direct bookmarks may be moved; by default "Other bookmarks". */
  sourceFolderIds: string[];
  /** Bookmarks the user filed himself (corrections): bookmarkId → folderId. */
  examples?: Map<string, string>;
  lang: string;
  options?: Partial<ClassifyOptions>;
  /** Receives intermediate results, for evaluation tools. */
  trace?: (step: string, data: Record<string, unknown>) => void;
}

type Group = 'A' | 'C' | 'S';
const GROUP: Record<Usage, Group> = { access: 'A', tool: 'A', learn: 'C', read: 'C', follow: 'S' };
/** Signals that establish a usage clearly enough to file a bookmark into a usage folder ("Tools", "Read later"). */
const STRONG_SIGNALS: Record<Usage, string[]> = {
  access: ['private-host', 'remote-access', 'known-app', 'account', 'login-page'],
  tool: ['tool-words'],
  learn: ['learn-words'],
  read: ['article'],
  follow: ['frequent-home'],
};
/** Big platforms whose subdomains are not a personal domain. */
const BIG_PLATFORMS = /(^|\.)(google|microsoft|live|office|amazon|apple|icloud|github|gitlab|atlassian|notion|dropbox|yahoo|facebook|adobe|salesforce|zoom|slack|ovh|orange|free|sfr|bouyguestelecom)\./;

function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] ?? 0) * (b[i] ?? 0);
  return s;
}

function meanVector(vs: Float32Array[], normalize: boolean): Float32Array {
  const out = new Float32Array(vs[0]?.length ?? 0);
  for (const v of vs) for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) + (v[i] ?? 0) / vs.length;
  if (normalize) {
    let n = 0;
    for (const x of out) n += x * x;
    n = Math.sqrt(n) || 1;
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) / n;
  }
  return out;
}

function meanSparse(vs: SparseVector[]): SparseVector {
  const out: SparseVector = new Map();
  for (const v of vs) for (const [k, x] of v) out.set(k, (out.get(k) ?? 0) + x / vs.length);
  return out;
}

/** Deterministic pseudo-random generator, so that a proposal can be reproduced. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mean and standard deviation of f over all pairs, or over a sample of pairs for large collections. */
function pairStats(n: number, f: (i: number, j: number) => number): { mu: number; sd: number } {
  const values: number[] = [];
  if (n * (n - 1) <= 60000) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) values.push(f(i, j));
  } else {
    const rnd = mulberry32(42);
    for (let k = 0; k < 30000; k++) {
      const i = Math.floor(rnd() * n);
      const j = Math.floor(rnd() * n);
      if (i !== j) values.push(f(i, j));
    }
  }
  const mu = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mu) ** 2, 0) / (values.length || 1)) || 1;
  return { mu, sd };
}

function softmax(o: Record<Usage, number>, t = 0.05): Record<Usage, number> {
  const m = Math.max(...USAGES.map((k) => o[k]));
  const e = Object.fromEntries(USAGES.map((k) => [k, Math.exp((o[k] - m) / t)])) as Record<Usage, number>;
  const z = USAGES.reduce((a, k) => a + e[k], 0);
  return Object.fromEntries(USAGES.map((k) => [k, e[k] / z])) as Record<Usage, number>;
}

/** Average-linkage agglomerative clustering on a dense similarity matrix; returns groups of indices into `items`. */
function cluster(items: number[], sim: (a: number, b: number) => number, threshold: number): number[][] {
  const n = items.length;
  const m = new Float64Array(n * n);
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const s = sim(items[a] as number, items[b] as number);
    m[a * n + b] = s;
    m[b * n + a] = s;
  }
  const members: number[][] = items.map((i) => [i]);
  const alive = new Uint8Array(n).fill(1);
  for (;;) {
    let best = -Infinity;
    let ba = -1;
    let bb = -1;
    for (let a = 0; a < n; a++) {
      if (!alive[a]) continue;
      for (let b = a + 1; b < n; b++) {
        if (alive[b] && (m[a * n + b] as number) > best) { best = m[a * n + b] as number; ba = a; bb = b; }
      }
    }
    if (ba < 0 || best < threshold) break;
    const na = (members[ba] as number[]).length;
    const nb = (members[bb] as number[]).length;
    for (let c = 0; c < n; c++) {
      if (!alive[c] || c === ba || c === bb) continue;
      const s = ((m[ba * n + c] as number) * na + (m[bb * n + c] as number) * nb) / (na + nb);
      m[ba * n + c] = s;
      m[c * n + ba] = s;
    }
    members[ba] = (members[ba] as number[]).concat(members[bb] as number[]);
    alive[bb] = 0;
  }
  return members.filter((_, a) => alive[a]);
}

export function classify(input: ClassifyInput): Proposal {
  const o = { ...DEFAULT_OPTIONS, ...input.options };
  const { snapshot, features, vectors, lang } = input;
  const sources = new Set(input.sourceFolderIds);
  const isWeb = (id: string) => /^https?:/i.test(snapshot.bookmarks.get(id)?.url ?? '');

  // Destination folders: every non-root folder that is not itself a source.
  const destFolders = [...snapshot.folders.values()].filter((f) => !f.isRoot && !sources.has(f.id) && !f.unmodifiable && f.folderType !== 'managed');
  const candidates = [...snapshot.bookmarks.values()].filter((b) => sources.has(b.parentId) && !b.unmodifiable && isWeb(b.id) && vectors.has(b.id)).map((b) => b.id);
  const members = new Map<string, string[]>(destFolders.map((f) => [f.id, f.bookmarkIds.filter((id) => isWeb(id) && vectors.has(id)).slice(0, 40)]));

  // Documents = candidates + folder members.
  const docIds = [...new Set([...candidates, ...[...members.values()].flat()])];
  const idx = new Map(docIds.map((id, i) => [id, i]));
  const vec = docIds.map((id) => vectors.get(id) as Float32Array);
  const feat = docIds.map((id) => features.get(id) as Features);

  // Usage: rules plus zero-shot similarity to usage descriptions.
  const usage = feat.map((f, i) => {
    const zs = softmax(Object.fromEntries(USAGES.map((k) => [k, dot(vec[i] as Float32Array, input.usageVectors[k])])) as Record<Usage, number>);
    let best: Usage = f.usage;
    let bestScore = -Infinity;
    for (const k of USAGES) {
      const s = f.usageScores[k] + 2 * zs[k];
      if (s > bestScore) { bestScore = s; best = k; }
    }
    return best;
  });
  const grp = (i: number): Group => GROUP[usage[i] as Usage];
  const strong = (i: number, u: Usage) => STRONG_SIGNALS[u].some((s) => (feat[i] as Features).signals.includes(s));

  // Similarities, standardised against the collection so that thresholds do not depend on the model.
  const kw: SparseVector[] = tfidf(feat.map((f) => f.words));
  const e = pairStats(docIds.length, (i, j) => dot(vec[i] as Float32Array, vec[j] as Float32Array));
  const k = pairStats(docIds.length, (i, j) => sparseDot(kw[i] as SparseVector, kw[j] as SparseVector));
  // Subject labels only: format labels ("Tools", "Learning"…) would link pages that merely look alike.
  const topics = input.labels.filter((l) => !l.entry.format);
  const labelSims = vec.map((v) => topics.map((l) => dot(v, l.vector)));
  const labelStats = topics.map((_, c) => {
    const col = labelSims.map((r) => r[c] ?? 0);
    const mu = col.reduce((a, b) => a + b, 0) / (col.length || 1);
    return { mu, sd: Math.sqrt(col.reduce((a, b) => a + (b - mu) ** 2, 0) / (col.length || 1)) || 1 };
  });
  const labelZ = (v: Float32Array, c: number) => (dot(v, (topics[c] as { vector: Float32Array }).vector) - (labelStats[c] as { mu: number }).mu) / (labelStats[c] as { sd: number }).sd;
  const topLabel = vec.map((v) => {
    let c = -1;
    let z = -Infinity;
    for (let t = 0; t < topics.length; t++) {
      const zt = labelZ(v, t);
      if (zt > z) { z = zt; c = t; }
    }
    return { c, z };
  });
  // Subject profile: how much each subject label stands out for this bookmark. Two bookmarks about the same
  // subject have similar profiles even when their wording differs; similar wording on different subjects does not.
  const profile = vec.map((v) => {
    const p = new Float32Array(topics.length);
    let n = 0;
    for (let t = 0; t < topics.length; t++) {
      const z = Math.max(0, labelZ(v, t));
      p[t] = z;
      n += z * z;
    }
    n = Math.sqrt(n) || 1;
    for (let t = 0; t < p.length; t++) p[t] = (p[t] ?? 0) / n;
    return p;
  });
  const l = pairStats(docIds.length, (i, j) => dot(profile[i] as Float32Array, profile[j] as Float32Array));
  // Combined similarity, standardised again so that thresholds read as "standard deviations above average".
  const raw = (ze: number, zk: number, zl: number) => ze + o.wKw * zk + o.wLab * zl;
  const pairRaw = (i: number, j: number) =>
    raw((dot(vec[i] as Float32Array, vec[j] as Float32Array) - e.mu) / e.sd, (sparseDot(kw[i] as SparseVector, kw[j] as SparseVector) - k.mu) / k.sd, (dot(profile[i] as Float32Array, profile[j] as Float32Array) - l.mu) / l.sd);
  const c = pairStats(docIds.length, pairRaw);
  const Z = (i: number, j: number): number => (pairRaw(i, j) - c.mu) / c.sd;

  // Affinity of a bookmark with a folder = average of Z with its members, computed from the members' means.
  const profiles = new Map(destFolders.map((f) => {
    const ms = (members.get(f.id) ?? []).map((id) => idx.get(id) as number);
    return [f.id, {
      n: ms.length,
      v: ms.length ? meanVector(ms.map((m) => vec[m] as Float32Array), false) : null,
      kw: meanSparse(ms.map((m) => kw[m] as SparseVector)),
      p: ms.length ? meanVector(ms.map((m) => profile[m] as Float32Array), false) : null,
      groups: new Set(ms.map(grp)),
    }];
  }));
  const affinity = (i: number, folderId: string): number => {
    const p = profiles.get(folderId);
    if (!p?.v || !p.p) return -Infinity;
    const r = raw((dot(vec[i] as Float32Array, p.v) - e.mu) / e.sd, (sparseDot(kw[i] as SparseVector, p.kw) - k.mu) / k.sd, (dot(profile[i] as Float32Array, p.p) - l.mu) / l.sd);
    return (r - c.mu) / c.sd;
  };
  const folderUsage = new Map(destFolders.map((f) => [f.id, usageOfFolderTitle(f.title)]));
  const hasGroup = (folderId: string, g: Group) => profiles.get(folderId)?.groups.has(g) ?? false;
  const folderByVocab = new Map<string, FolderItem>();
  for (const f of destFolders) {
    const v = vocabForTitle(f.title);
    if (v && !folderByVocab.has(v.id)) folderByVocab.set(v.id, f);
  }
  input.trace?.('similarity', { Z, idx });
  input.trace?.('documents', {
    docs: docIds.map((id, i) => ({ id, usage: usage[i], strong: strong(i, usage[i] as Usage), label: topics[(topLabel[i] as { c: number }).c]?.entry.id, labelZ: Number((topLabel[i] as { z: number }).z.toFixed(2)) })),
  });

  const placements: Placement[] = [];
  const review: ReviewItem[] = [];
  const newFolders: NewFolder[] = [];
  const placed = new Set<number>();
  const place = (i: number, target: Placement['target'], reason: Reason) => {
    placements.push({ bookmarkId: docIds[i] as string, target, reason });
    placed.add(i);
  };
  const otherId = snapshot.otherId ?? input.sourceFolderIds[0] ?? '';
  const newFolder = (vocab: VocabEntry | null, fallbackName: string, reason: Reason): string => {
    const key = `new-${newFolders.length + 1}`;
    newFolders.push({ key, vocabId: vocab?.id ?? null, name: vocab ? vocabName(vocab, lang) : fallbackName, emoji: vocab?.emoji ?? '📁', parentId: otherId, reason });
    return key;
  };
  const vocabEntry = (id: string) => input.labels.find((l) => l.entry.id === id)?.entry ?? null;
  const cand = candidates.map((id) => idx.get(id) as number);

  // 1. Not enough evidence: the bookmark stays where it is, with a short reason.
  for (const i of cand) {
    if ((feat[i] as Features).insufficient) {
      review.push({ bookmarkId: docIds[i] as string, reason: { key: 'reviewVague' } });
      placed.add(i);
    }
  }

  // 2. Corrections: follow the nearest bookmark the user filed himself.
  // A correction only counts while the bookmark is still where the user put it.
  const examples = [...(input.examples ?? new Map()).entries()].filter(([id, folderId]) => idx.has(id) && snapshot.bookmarks.get(id)?.parentId === folderId);
  for (const i of cand) {
    if (placed.has(i) || !examples.length) continue;
    let best: { z: number; id: string; folderId: string } | null = null;
    for (const [id, folderId] of examples) {
      const z = Z(i, idx.get(id) as number);
      if (!best || z > best.z) best = { z, id, folderId };
    }
    if (best && best.z >= o.knnZ) {
      place(i, { kind: 'existing', folderId: best.folderId }, { key: 'reasonExample', subs: [snapshot.bookmarks.get(best.id)?.title ?? '', snapshot.folders.get(best.folderId)?.title ?? ''] });
    }
  }

  // 3. Services hosted at home: private address, remote-access suffix or personal domain.
  const hostsByDomain = new Map<string, Set<string>>();
  for (const f of feat) {
    if (f.privateHost || !f.registrable || f.host === f.registrable) continue;
    const s = hostsByDomain.get(f.registrable) ?? new Set();
    s.add(f.host);
    hostsByDomain.set(f.registrable, s);
  }
  const isHome = (i: number) => {
    const f = feat[i] as Features;
    if (usage[i] !== 'access') return false;
    if (f.privateHost || f.remoteAccessHost) return true;
    return (hostsByDomain.get(f.registrable)?.size ?? 0) >= 2 && !BIG_PLATFORMS.test(`.${f.registrable}`);
  };
  const homeCands = cand.filter((i) => !placed.has(i) && isHome(i));
  for (const i of homeCands) {
    let best: { f: FolderItem; a: number } | null = null;
    for (const f of destFolders) {
      if (folderUsage.get(f.id) || !hasGroup(f.id, 'A')) continue;
      const a = affinity(i, f.id);
      if (!best || a > best.a) best = { f, a };
    }
    if (best && best.a >= o.zAssign) place(i, { kind: 'existing', folderId: best.f.id }, { key: 'reasonTopicHasServices', subs: [best.f.title] });
  }
  const homeLeft = homeCands.filter((i) => !placed.has(i));
  const homeFolder = folderByVocab.get('home-services');
  if (homeFolder) {
    for (const i of homeLeft) place(i, { kind: 'existing', folderId: homeFolder.id }, { key: 'reasonHomeService' });
  } else if (homeLeft.length >= o.minGroupSize) {
    const key = newFolder(vocabEntry('home-services'), 'Services', { key: 'reasonHomeService' });
    for (const i of homeLeft) place(i, { kind: 'new', key }, { key: 'reasonHomeService' });
  }

  // 4. Guides about applications the user hosts at home.
  const homeApps = new Set(docIds.map((_, i) => i).filter(isHome).flatMap((i) => allKnownAppsIn((feat[i] as Features).bestTitle)));
  const appsOf = (i: number) => allKnownAppsIn((feat[i] as Features).bestTitle).filter((a) => homeApps.has(a));
  const pending: number[] = [];
  for (const i of cand) {
    if (placed.has(i) || grp(i) !== 'C') continue;
    const apps = appsOf(i);
    if (!apps.length) continue;
    const f = destFolders.find((d) => !folderUsage.get(d.id) && (members.get(d.id) ?? []).some((id) => appsOf(idx.get(id) as number).some((a) => apps.includes(a))));
    if (f) place(i, { kind: 'existing', folderId: f.id }, { key: 'reasonAppGuide', subs: [apps[0] as string, f.title] });
    else pending.push(i);
  }
  const selfHostFolder = folderByVocab.get('self-hosting');
  if (pending.length && (selfHostFolder || pending.length >= o.minGroupSize)) {
    const target: Placement['target'] = selfHostFolder
      ? { kind: 'existing', folderId: selfHostFolder.id }
      : { kind: 'new', key: newFolder(vocabEntry('self-hosting'), 'Self-hosting', { key: 'reasonSelfHostGuides' }) };
    for (const i of pending) place(i, target, { key: 'reasonSelfHostGuide', subs: [appsOf(i)[0] as string] });
  }

  // 5. Existing folders, when both the subject and the usage fit. Usage folders need the same similarity, without bonus.
  const pool: number[] = [];
  for (const i of cand) {
    if (placed.has(i)) continue;
    const scored: { f: FolderItem; s: number; reason: Reason }[] = [];
    for (const f of destFolders) {
      const u = folderUsage.get(f.id);
      const a = affinity(i, f.id);
      if (a === -Infinity) continue;
      if (u) {
        if (usage[i] === u) scored.push({ f, s: a, reason: { key: 'reasonUsageFolder', subs: [f.title] } });
      } else if (hasGroup(f.id, grp(i))) {
        scored.push({ f, s: a, reason: { key: 'reasonTopicFolder', subs: [f.title] } });
      }
    }
    scored.sort((x, y) => y.s - x.s);
    const [first, second] = scored;
    if (first && first.s >= o.zAssign && first.s - (second?.s ?? -Infinity) >= o.zMargin) place(i, { kind: 'existing', folderId: first.f.id }, first.reason);
    else pool.push(i);
  }

  // 6. New folders: average-linkage clustering of what is left, named after the closest subject label.
  const groups = cluster(pool.slice(0, o.maxClusterItems), Z, o.zLink);
  const usedVocab = new Set<string>(newFolders.flatMap((f) => (f.vocabId ? [f.vocabId] : [])));
  for (const c of groups) {
    if (c.length < o.minGroupSize) continue;
    const centroid = meanVector(c.map((i) => vec[i] as Float32Array), true);
    const ranked = topics.map((l, t) => ({ l, z: labelZ(centroid, t) })).sort((x, y) => y.z - x.z);
    const best = ranked.find((r) => !usedVocab.has(r.l.entry.id));
    const existing = best ? folderByVocab.get(best.l.entry.id) : undefined;
    input.trace?.('group', { ids: c.map((i) => docIds[i]), label: best?.l.entry.id, labelZ: best ? Number(best.z.toFixed(2)) : null, existing: existing?.title });
    if (existing) {
      for (const i of c) place(i, { kind: 'existing', folderId: existing.id }, { key: 'reasonTopicFolder', subs: [existing.title] });
      continue;
    }
    // A weak label would give a misleading name: use the most shared keyword instead.
    const entry = best && best.z >= 1 ? best.l.entry : null;
    const counts = new Map<string, number>();
    for (const i of c) for (const w of new Set((feat[i] as Features).words)) counts.set(w, (counts.get(w) ?? 0) + 1);
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'Dossier';
    const key = newFolder(entry, top.charAt(0).toUpperCase() + top.slice(1), { key: 'reasonNewGroup', subs: [String(c.length)] });
    if (entry) usedVocab.add(entry.id);
    for (const i of c) place(i, { kind: 'new', key }, { key: 'reasonNewGroup', subs: [String(c.length)] });
  }

  // 7. Leftovers: a usage folder only when the usage is clearly established, otherwise they stay where they are.
  for (const i of cand) {
    if (placed.has(i)) continue;
    const u = usage[i] as Usage;
    const f = strong(i, u) ? destFolders.find((d) => folderUsage.get(d.id) === u) : undefined;
    if (f) place(i, { kind: 'existing', folderId: f.id }, { key: 'reasonUsageFolder', subs: [f.title] });
    else place(i, { kind: 'stay' }, { key: 'reasonStay' });
  }

  // Titles: cleaned titles for the bookmarks to organize and for the bookmarks bar.
  const titles: Record<string, string> = {};
  for (const b of snapshot.bookmarks.values()) {
    const f = features.get(b.id);
    if (!f || !(sources.has(b.parentId) || b.parentId === snapshot.barId)) continue;
    let t = f.cleanTitle;
    if (b.parentId === snapshot.barId && (t ?? b.title).length > 24) {
      const head = (t ?? b.title).split(/\s+[-|–—·:]\s+/)[0]?.replace(/\.(com|fr|org|net|io)$/i, '');
      if (head && head.length >= 3) t = head;
    }
    if (t && t !== b.title) titles[b.id] = t;
  }

  // Emoji for existing folders that have none.
  const folderEmojis: Record<string, string> = {};
  for (const f of destFolders) {
    if (leadingEmoji(f.title)) continue;
    const v = vocabForTitle(f.title);
    if (v) { folderEmojis[f.id] = v.emoji; continue; }
    const fv = input.folderVectors?.get(f.id);
    if (!fv || !stripEmoji(f.title)) continue;
    const ranked = input.labels.map((l) => ({ l, s: dot(fv, l.vector) })).sort((x, y) => y.s - x.s);
    const [top, next] = ranked;
    if (top && next && top.s - next.s > 0.01) folderEmojis[f.id] = top.l.entry.emoji;
  }

  return { snapshotTakenAt: snapshot.takenAt, placements, newFolders, review, titles, folderEmojis };
}
