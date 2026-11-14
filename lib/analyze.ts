import { browser } from 'wxt/browser';
import pslText from './data/public_suffix_list.dat?raw';
import { type Assessment, type CategorizeInput, type CategorizeResult, type Destination, categorize } from './categorize';
import type { EmbedProgress, Embedder } from './embedder';
import { exampleVectors } from './examples';
import { prepare, pruneScope, remainingFolders, splitVectors } from './pipeline';
import { loadPublicSuffixList } from './psl';
import { DEFAULT_POOL, type SiteRequest, type SiteVerdict, mergePages, pageText, readSites, siteRoot } from './site';
import { buildSnapshot, type TreeNode } from './snapshot';
import type { Features, HistoryInfo, Proposal, Snapshot } from './types';
import { siteKey } from './url';

loadPublicSuffixList(pslText);

export type AnalysisPhase = 'reading' | 'loading' | 'embedding' | 'sites' | 'pages' | 'grouping';

export interface Analysis {
  snapshot: Snapshot;
  features: Map<string, Features>;
  proposal: Proposal;
  scopeFolderIds: string[];
  /** Folders left out inside the chosen ones: they stay where they are. */
  scopeExcluded: string[];
  /** Pages read and sites checked during this analysis. */
  sitesChecked: number;
  destination: Destination;
  /** What the model worked from, and what it concluded: kept to analyse a folder again during the review. */
  input: CategorizeInput;
  assessments: Map<string, Assessment>;
}

export interface AnalyzeOptions {
  embedder: Embedder;
  useHistory: boolean;
  scopeFolderIds: string[];
  scopeExcluded: string[];
  /** Categories the user chose in earlier sorts. */
  learned?: CategorizeInput['learned'];
  /** Icons of the most visited sites at the start of the bookmarks bar. */
  quickAccess: number;
  known: CategorizeInput['known'];
  destination: Destination;
  /** Read the pages of the bookmarks the title does not explain (needs the permission to access sites). */
  readSites: boolean;
  /** Check every bookmark for sites that no longer answer (same permission). */
  checkDead: boolean;
  /** Remove the copies of a page kept elsewhere. */
  removeDuplicates: boolean;
  lang: string;
  signal?: AbortSignal;
  onProgress: (phase: AnalysisPhase, done: number, total: number) => void;
}

/** Pages read to understand a bookmark go further than pages that are only checked. */
const READ_BYTES = 128 * 1024;
const CHECK_BYTES = 16 * 1024;

/** The whole history (maxResults 0: no limit), by address, and the visits of each site (typed visits count twice). */
async function readHistory(): Promise<{ byUrl: Map<string, HistoryInfo>; hostVisits: Map<string, number> }> {
  const items = await browser.history.search({ text: '', startTime: 0, maxResults: 0 });
  const byUrl = new Map<string, HistoryInfo>();
  const hostVisits = new Map<string, number>();
  for (const h of items) {
    if (!h.url) continue;
    const info = { title: h.title, visitCount: h.visitCount ?? 0, typedCount: h.typedCount ?? 0 };
    byUrl.set(h.url, info);
    const site = siteKey(h.url);
    if (site) hostVisits.set(site, (hostVisits.get(site) ?? 0) + info.visitCount + 2 * info.typedCount);
  }
  return { byUrl, hostVisits };
}

export async function analyze(o: AnalyzeOptions): Promise<Analysis> {
  o.onProgress('reading', 0, 1);
  const snapshot = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
  const history = o.useHistory ? await readHistory().catch(() => undefined) : undefined;
  // A rebuild archives whole folders: only root folders and the folders right inside them can be chosen.
  const excluded = pruneScope(snapshot, o.scopeExcluded);
  const p = prepare(snapshot, history?.byUrl, pruneScope(snapshot, o.scopeFolderIds), o.lang, excluded);
  const vectors = await o.embedder.embed(p.texts, (e: EmbedProgress) => o.onProgress(e.phase, e.done, e.total));
  const input: CategorizeInput = {
    snapshot,
    features: p.features,
    candidates: p.candidates,
    ...splitVectors(p, vectors),
    labeled: exampleVectors(),
    pageVectors: new Map(),
    sites: new Map(),
    duplicates: o.removeDuplicates ? p.duplicates : [],
    siteReading: o.readSites,
    learned: o.learned,
    hostVisits: history?.hostVisits,
    barInScope: !!snapshot.barId && p.scopeFolderIds.includes(snapshot.barId) && !excluded.includes(snapshot.barId),
    remaining: remainingFolders(snapshot, p.scopeFolderIds, excluded),
    known: o.known,
    destination: o.destination,
    lang: o.lang,
    options: { quickAccess: o.quickAccess },
  };
  let result = categorize(input);
  let sitesChecked = 0;
  let final = input;
  if (o.readSites || o.checkDead) {
    const unclear = o.readSites ? p.candidates.filter((id) => result.assessments.get(id)?.unclear) : [];
    const read = await readAndClassify(input, result, { check: o.checkDead ? p.candidates : [], read: unclear, deeper: o.readSites, checkDead: o.checkDead, embedder: o.embedder, signal: o.signal, onProgress: o.onProgress });
    ({ result, input: final, sitesChecked } = read);
  }
  o.onProgress('grouping', 1, 1);
  return { snapshot, features: p.features, proposal: result.proposal, scopeFolderIds: p.scopeFolderIds, scopeExcluded: excluded, sitesChecked, destination: o.destination, input: final, assessments: result.assessments };
}

interface ReadOptions {
  /** Bookmarks checked for sites that no longer answer. */
  check: string[];
  /** Bookmarks whose page is read to understand them. */
  read: string[];
  /** Bookmarks still to check afterwards are read too, with the home page of their site. */
  deeper: boolean;
  /** Only these bookmarks are read in that second pass (all by default). */
  scope?: Set<string>;
  checkDead: boolean;
  embedder: Embedder;
  signal?: AbortSignal;
  onProgress: (phase: AnalysisPhase, done: number, total: number) => void;
}

/**
 * Reads pages (several at a time) and classifies again with them. Every bookmark left to check is then tested:
 * read if it was not, and when its page says too little, the home page of its site is read as well.
 */
async function readAndClassify(input: CategorizeInput, first: CategorizeResult, o: ReadOptions): Promise<{ result: CategorizeResult; input: CategorizeInput; sitesChecked: number }> {
  const { snapshot } = input;
  const removed = new Set(input.duplicates?.map((d) => d.bookmarkId));
  // Addresses only reachable at home and home services are never requested from here; nor are duplicates.
  const requestable = (id: string) => {
    const f = input.features.get(id);
    return !!f && !f.privateHost && !f.remoteAccessHost && !removed.has(id) && first.assessments.get(id)?.category !== 'home-services' && /^https?:/i.test(snapshot.bookmarks.get(id)?.url ?? '');
  };
  const wanted = new Set(o.read);
  const ids = [...new Set([...o.check, ...o.read])].filter(requestable);
  const fetchAll = async (requests: SiteRequest[]) =>
    requests.length ? readSites(requests, { ...DEFAULT_POOL, signal: o.signal, onProgress: (d, t) => o.onProgress('sites', d, t) }) : new Map<string, SiteVerdict>();
  const verdicts = await fetchAll(ids.map((id) => ({ id, url: snapshot.bookmarks.get(id)?.url as string, maxBytes: wanted.has(id) ? READ_BYTES : CHECK_BYTES })));
  // Stopped meanwhile: nothing more is read, embedded or classified.
  o.signal?.throwIfAborted();
  let sitesChecked = verdicts.size;
  const sites = new Map(input.sites);
  const pageVectors = new Map(input.pageVectors);
  // A page read only to check that the site answers does not reopen a decision already clear.
  const keep = (id: string, v: SiteVerdict, read: boolean) => {
    if (v.kind === 'dead' && !o.checkDead) return;
    if (v.kind === 'ok' && !read) return;
    sites.set(id, v);
    pageVectors.delete(id);
  };
  for (const [id, v] of verdicts) keep(id, v, wanted.has(id));
  const embedPages = async () => {
    const pages = [...sites.entries()].flatMap(([id, v]) => (v.kind === 'ok' && pageText(v.page) && !pageVectors.has(id) ? [{ id, text: pageText(v.page) }] : []));
    if (!pages.length) return;
    const pv = await o.embedder.embed(pages.map((x) => x.text), (e: EmbedProgress) => o.onProgress(e.phase === 'loading' ? 'loading' : 'pages', e.done, e.total));
    pages.forEach((x, i) => pageVectors.set(x.id, pv[i] as Float32Array));
  };
  await embedPages();
  o.signal?.throwIfAborted();
  let result = categorize({ ...input, sites, pageVectors });

  if (o.deeper) {
    const toCheck = result.proposal.review.map((r) => r.bookmarkId).filter((id) => requestable(id) && (!o.scope || o.scope.has(id)));
    const unread = toCheck.filter((id) => {
      const v = verdicts.get(id) ?? input.sites.get(id);
      return !v || v.kind === 'unknown';
    });
    const rootOf = new Map<string, string>();
    for (const id of toCheck) {
      const v = sites.get(id);
      const root = v?.kind === 'ok' ? siteRoot(v.page.url || (snapshot.bookmarks.get(id)?.url as string)) : null;
      if (root) rootOf.set(id, root);
    }
    const more = await fetchAll([
      ...unread.map((id) => ({ id, url: snapshot.bookmarks.get(id)?.url as string, maxBytes: READ_BYTES })),
      ...[...new Set(rootOf.values())].map((root) => ({ id: `root:${root}`, url: root, maxBytes: READ_BYTES })),
    ]);
    o.signal?.throwIfAborted();
    sitesChecked += more.size;
    for (const id of unread) {
      const v = more.get(id);
      if (v) keep(id, v, true);
    }
    for (const [id, root] of rootOf) {
      const v = sites.get(id);
      const r = more.get(`root:${root}`);
      if (v?.kind === 'ok' && r?.kind === 'ok') {
        sites.set(id, { kind: 'ok', page: mergePages(v.page, r.page) });
        pageVectors.delete(id);
      }
    }
    if (more.size) {
      await embedPages();
      o.signal?.throwIfAborted();
      result = categorize({ ...input, sites, pageVectors });
    }
  }
  return { result, input: { ...input, sites, pageVectors }, sitesChecked };
}

export interface ReanalyzeOptions {
  embedder: Embedder;
  /** Bookmarks to analyse again. */
  ids: string[];
  /** Categories the user chose, in earlier sorts and during this review. */
  learned: CategorizeInput['learned'];
  /** Read the pages not read yet, and the home page of a site when a page says too little. */
  readSites: boolean;
  signal?: AbortSignal;
  onProgress: (phase: AnalysisPhase, done: number, total: number) => void;
}

/**
 * Analyses some bookmarks again during the review, with what the user taught meanwhile and, when allowed, the pages
 * not read yet: the first analysis only reads the pages it needs. The bookmarks the rules recognised are not read.
 */
export async function reanalyze(an: Analysis, o: ReanalyzeOptions): Promise<{ result: CategorizeResult; input: CategorizeInput; sitesChecked: number }> {
  const input: CategorizeInput = { ...an.input, learned: o.learned, siteReading: an.input.siteReading || o.readSites };
  o.signal?.throwIfAborted();
  const first = categorize(input);
  if (!o.readSites) return { result: first, input: an.input, sitesChecked: 0 };
  const toRead = o.ids.filter((id) => {
    const v = input.sites.get(id);
    return first.assessments.get(id)?.confidence !== 'evident' && (!v || v.kind === 'unknown');
  });
  const res = await readAndClassify(input, first, { check: [], read: toRead, deeper: true, scope: new Set(o.ids), checkDead: true, embedder: o.embedder, signal: o.signal, onProgress: o.onProgress });
  return { result: res.result, input: { ...res.input, learned: an.input.learned }, sitesChecked: res.sitesChecked };
}
