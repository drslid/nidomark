import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CategorizeInput, type CategorizeOptions, type Destination, REVIEW_KEY, categorize } from '../../lib/categorize';
import { exampleVectors } from '../../lib/examples';
import { prepare, splitVectors } from '../../lib/pipeline';
import { loadPublicSuffixList } from '../../lib/psl';
import type { PageInfo, SiteVerdict } from '../../lib/site';
import { pageText } from '../../lib/site';
import { buildSnapshot } from '../../lib/snapshot';
import type { Proposal, Snapshot } from '../../lib/types';
import { siteKey } from '../../lib/url';
import { corpus } from './corpus.js';
import { SCENARIOS, buildTree, corpusHistory } from './tree';

export { SCENARIOS, buildTree } from './tree';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadPublicSuffixList(fs.readFileSync(path.join(HERE, '..', '..', 'lib', 'data', 'public_suffix_list.dat'), 'utf8'));

/** Vectors computed by the packaged model for every text of the pipeline (scripts/fixture-vectors.ts). */
const FIXTURE = path.join(HERE, 'e5-pipeline-vectors.json');
const VECTORS = new Map(
  Object.entries(fs.existsSync(FIXTURE) ? (JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as { vectors: Record<string, string> }).vectors : {}).map(([text, b64]) => {
    const buf = Buffer.from(b64, 'base64');
    return [text, new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))];
  }),
);

const vectorOf = (t: string) => {
  const v = VECTORS.get(t);
  if (!v) throw new Error(`No fixture vector for "${t}": run \`pnpm fixtures\``);
  return v;
};

/** What reading each page of the collection returns, as the site reader would extract it. */
export function corpusPages(): Map<string, SiteVerdict> {
  const out = new Map<string, SiteVerdict>();
  for (const b of corpus) {
    if (!b.page) continue;
    const page: PageInfo = { url: b.url, status: 200, title: b.page.title, description: b.page.desc, siteName: '', ogType: '', keywords: '', lang: 'fr', headings: b.page.heads, text: b.page.text, adult: false };
    out.set(b.id, { kind: 'ok', page });
  }
  return out;
}

export interface InputOptions {
  scenario?: keyof typeof SCENARIOS;
  /** Use the browsing history (real page titles, visits); off by default in the extension. */
  history?: boolean;
  /** Read the pages, as with the permission to access sites. */
  pages?: boolean;
  lang?: string;
  destination?: Destination;
  learned?: CategorizeInput['learned'];
  options?: Partial<CategorizeOptions>;
}

/** Visits of each site, as the extension counts them from the history: typed visits count twice. */
export function corpusVisits(): Map<string, number> {
  const out = new Map<string, number>();
  for (const b of corpus) out.set(siteKey(b.url), (out.get(siteKey(b.url)) ?? 0) + b.visits + 2 * b.typed);
  return out;
}

/** Categorizer input for the fictitious collection, built by the extension's own pipeline, whole tree in scope. */
export function buildInput(o: InputOptions = {}): CategorizeInput {
  const snapshot = buildSnapshot(buildTree(SCENARIOS[o.scenario ?? 'base']), 1);
  const lang = o.lang ?? 'fr';
  const p = prepare(snapshot, o.history ? corpusHistory() : undefined, ['1', '2'], lang);
  const sites = o.pages ? corpusPages() : new Map<string, SiteVerdict>();
  const pageVectors = new Map<string, Float32Array>();
  for (const [id, v] of sites) if (v.kind === 'ok' && pageText(v.page)) pageVectors.set(id, vectorOf(pageText(v.page)));
  return {
    snapshot,
    features: p.features,
    candidates: p.candidates,
    ...splitVectors(p, p.texts.map(vectorOf)),
    labeled: exampleVectors(),
    pageVectors,
    sites,
    duplicates: p.duplicates,
    siteReading: !!o.pages,
    learned: o.learned,
    hostVisits: o.history ? corpusVisits() : undefined,
    known: new Map(),
    destination: o.destination ?? 'bar',
    lang,
    options: o.options,
  };
}

export function run(o: InputOptions = {}): { proposal: Proposal; snapshot: Snapshot } {
  const input = buildInput(o);
  return { proposal: categorize(input).proposal, snapshot: input.snapshot };
}

/** Where each bookmark ends up, as a readable path: "Tech › Développement", "(barre)", "(à vérifier)", "(doublon)". */
export function destinationsOf(proposal: Proposal, snapshot: Snapshot): Record<string, string> {
  const byKey = new Map(proposal.newFolders.map((f) => [f.key, f]));
  const newPath = (key: string): string => {
    const f = byKey.get(key);
    if (!f) return key;
    return f.parentKey ? `${newPath(f.parentKey)} › ${f.name}` : f.name;
  };
  const dupes = new Set(proposal.duplicates.map((d) => d.bookmarkId));
  const out: Record<string, string> = {};
  for (const pl of proposal.placements) {
    if (dupes.has(pl.bookmarkId)) out[pl.bookmarkId] = '(doublon)';
    else if (pl.target.kind === 'bar') out[pl.bookmarkId] = '(barre)';
    else if (pl.target.kind === 'stay') out[pl.bookmarkId] = '(reste)';
    else if (pl.target.kind === 'existing') out[pl.bookmarkId] = snapshot.folders.get(pl.target.folderId)?.title ?? pl.target.folderId;
    else if (pl.target.key === REVIEW_KEY) out[pl.bookmarkId] = '(à vérifier)';
    else out[pl.bookmarkId] = newPath(pl.target.key);
  }
  return out;
}
