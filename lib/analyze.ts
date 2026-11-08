import { browser } from 'wxt/browser';
import pslText from './data/public_suffix_list.dat?raw';
import { type CategorizeInput, type Destination, categorize } from './categorize';
import type { EmbedProgress, Embedder } from './embedder';
import { exampleVectors } from './examples';
import { prepare, pruneScope, splitVectors } from './pipeline';
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
    known: o.known,
    destination: o.destination,
    lang: o.lang,
    options: { quickAccess: o.quickAccess },
  };
  let result = categorize(input);
  let sitesChecked = 0;

  if (o.readSites || o.checkDead) {
    const removed = new Set(input.duplicates?.map((d) => d.bookmarkId));
    // Addresses only reachable at home and home services are never requested from here; nor are duplicates.
    const requestable = (id: string) => {
      const f = p.features.get(id);
      return !!f && !f.privateHost && !f.remoteAccessHost && !removed.has(id) && result.assessments.get(id)?.category !== 'home-services' && /^https?:/i.test(snapshot.bookmarks.get(id)?.url ?? '');
    };
    const unclear = new Set(o.readSites ? p.candidates.filter((id) => result.assessments.get(id)?.unclear) : []);
    const ids = [...new Set([...(o.checkDead ? p.candidates : []), ...unclear])].filter(requestable);
    const fetchAll = async (requests: SiteRequest[]) =>
      requests.length ? readSites(requests, { ...DEFAULT_POOL, signal: o.signal, onProgress: (d, t) => o.onProgress('sites', d, t) }) : new Map<string, SiteVerdict>();
    const verdicts = await fetchAll(ids.map((id) => ({ id, url: snapshot.bookmarks.get(id)?.url as string, maxBytes: unclear.has(id) ? READ_BYTES : CHECK_BYTES })));
    sitesChecked = verdicts.size;
    const sites = new Map<string, SiteVerdict>();
    // A page read only to check that the site answers does not reopen a decision already clear.
    const keep = (id: string, v: SiteVerdict, wanted: boolean) => {
      if (v.kind === 'dead' && !o.checkDead) return;
      if (v.kind === 'ok' && !wanted) return;
      sites.set(id, v);
    };
    for (const [id, v] of verdicts) keep(id, v, unclear.has(id));
    const pageVectors = new Map<string, Float32Array>();
    const embedPages = async () => {
      const pages = [...sites.entries()].flatMap(([id, v]) => (v.kind === 'ok' && pageText(v.page) && !pageVectors.has(id) ? [{ id, text: pageText(v.page) }] : []));
      if (!pages.length) return;
      const pv = await o.embedder.embed(pages.map((x) => x.text), (e: EmbedProgress) => o.onProgress(e.phase === 'loading' ? 'loading' : 'pages', e.done, e.total));
      pages.forEach((x, i) => pageVectors.set(x.id, pv[i] as Float32Array));
    };
    await embedPages();
    result = categorize({ ...input, sites, pageVectors });

    // Every bookmark left to check is tested: read it if it was not, and when its page says too little,
    // read the home page of its site as well.
    if (o.readSites) {
      const toCheck = result.proposal.review.map((r) => r.bookmarkId).filter(requestable);
      const unread = toCheck.filter((id) => !verdicts.has(id) || verdicts.get(id)?.kind === 'unknown');
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
        result = categorize({ ...input, sites, pageVectors });
      }
    }
  }
  o.onProgress('grouping', 1, 1);
  return { snapshot, features: p.features, proposal: result.proposal, scopeFolderIds: p.scopeFolderIds, scopeExcluded: excluded, sitesChecked, destination: o.destination };
}
