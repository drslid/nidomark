import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClassifyInput, ClassifyOptions } from '../../lib/classify';
import { prepare, toClassifyInput } from '../../lib/pipeline';
import { loadPublicSuffixList } from '../../lib/psl';
import { buildSnapshot } from '../../lib/snapshot';
import type { Proposal } from '../../lib/types';
import { SCENARIOS, buildTree, corpusHistory } from './tree';

export { EXPECTED, SCENARIOS, buildTree } from './tree';

const HERE = path.dirname(fileURLToPath(import.meta.url));
loadPublicSuffixList(fs.readFileSync(path.join(HERE, '..', '..', 'lib', 'data', 'public_suffix_list.dat'), 'utf8'));

/** Vectors computed by the packaged model for every text of the pipeline (scripts/fixture-vectors.ts). */
const VECTORS = new Map(
  Object.entries((JSON.parse(fs.readFileSync(path.join(HERE, 'e5-pipeline-vectors.json'), 'utf8')) as { vectors: Record<string, string> }).vectors).map(([text, b64]) => {
    const buf = Buffer.from(b64, 'base64');
    return [text, new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))];
  }),
);

export interface InputOptions {
  scenario?: keyof typeof SCENARIOS;
  /** Use the browsing history (real page titles, visits); off by default in the extension. */
  history?: boolean;
  lang?: string;
  examples?: Map<string, string>;
  options?: Partial<ClassifyOptions>;
}

/** Classifier input for the fictitious collection, built by the extension's own pipeline. */
export function buildInput(o: InputOptions = {}): ClassifyInput {
  const p = prepare(buildSnapshot(buildTree(SCENARIOS[o.scenario ?? 'base']), 1), o.history ? corpusHistory() : undefined, ['2'], o.lang ?? 'fr');
  const vectors = p.texts.map((t) => {
    const v = VECTORS.get(t);
    if (!v) throw new Error(`No fixture vector for "${t}": run \`pnpm fixtures\``);
    return v;
  });
  return { ...toClassifyInput(p, vectors, o.examples ?? new Map()), options: o.options };
}

/** Folder where each bookmark ends up, named like the reference proposal ("*" marks a name not taken from the vocabulary). */
export function placementNames(p: Proposal, input: ClassifyInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of p.review) out[r.bookmarkId] = 'À vérifier';
  for (const pl of p.placements) {
    if (pl.target.kind === 'stay') out[pl.bookmarkId] = '(racine)';
    else if (pl.target.kind === 'existing') out[pl.bookmarkId] = input.snapshot.folders.get(pl.target.folderId)?.title ?? '?';
    else {
      const key = pl.target.key;
      const nf = p.newFolders.find((f) => f.key === key);
      out[pl.bookmarkId] = nf?.vocabId ? nf.name : `${nf?.name ?? '?'}*`;
    }
  }
  return out;
}
