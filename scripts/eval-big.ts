// Sorts the large messy collection (tests/fixtures/big/collection.json) with the packaged model and measures what a
// user sees: bookmarks filed under their subject, each subject in one place, no folder twice under the same parent.
// The vectors are stored in tests/fixtures/big/vectors.json; missing ones are computed with the model.
// Usage: pnpm eval:big [--tree] [--wrong]; NIDO_OPTS='{"knnWeight":2}' tries other options.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIG_VECTORS, bigTexts, packVector, readBigVectors, scoreBig, sortBig } from '../tests/fixtures/big-collection';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));

const stored = readBigVectors();
const missing = [...new Set(bigTexts())].filter((t) => !stored[t]);
if (missing.length) {
  const { env, pipeline } = await import('@huggingface/transformers');
  const { MODEL_ID, modelInput } = await import('../lib/model');
  env.allowRemoteModels = false;
  env.localModelPath = path.join(ROOT, 'public', 'models') + path.sep;
  const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
  for (const [n, t] of missing.entries()) {
    stored[t] = packVector(new Float32Array((await extractor(modelInput(t), { pooling: 'mean', normalize: true })).data as Float32Array));
    if ((n + 1) % 100 === 0) console.error(`${n + 1}/${missing.length} vectors`);
  }
  const sorted = Object.fromEntries(Object.entries(stored).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BIG_VECTORS, `${JSON.stringify({ model: MODEL_ID, vectors: sorted })}\n`);
}

const { proposal, ms } = sortBig(process.env.NIDO_OPTS ? JSON.parse(process.env.NIDO_OPTS) : undefined);
const s = scoreBig(proposal);
if (args.has('--tree')) {
  const byKey = new Map(proposal.newFolders.map((f) => [f.key, f]));
  const kids = new Map<string, string[]>();
  for (const f of proposal.newFolders) kids.set(f.parentKey ?? `root:${f.parentId}`, [...(kids.get(f.parentKey ?? `root:${f.parentId}`) ?? []), f.key]);
  const count = new Map<string, number>();
  for (const pl of proposal.placements) if (pl.target.kind === 'new') count.set(pl.target.key, (count.get(pl.target.key) ?? 0) + 1);
  const show = (key: string, depth: number) => {
    const f = byKey.get(key);
    if (!f) return;
    console.log(`${'  '.repeat(depth)}${f.emoji ? `${f.emoji} ` : ''}${f.name} (${count.get(key) ?? 0})`);
    for (const k of kids.get(key) ?? []) show(k, depth + 1);
  };
  for (const [parent, keys] of kids) {
    if (!parent.startsWith('root:')) continue;
    console.log(parent === 'root:1' ? '— Bookmarks bar' : '— Other bookmarks');
    for (const k of keys) show(k, 1);
  }
}
if (args.has('--wrong')) for (const w of s.wrong) console.log(w);
console.log(`\nfiled under their subject: ${s.ok}/${s.total} (${((100 * s.ok) / Math.max(1, s.total)).toFixed(1)} %) · to check: ${proposal.review.length} · quick access: ${proposal.quickAccess.length} · duplicates: ${proposal.duplicates.length}`);
console.log(`folders: ${proposal.newFolders.length} · same name under one parent: ${s.twins.length} · inside a folder of the same name: ${s.nested.length} · names used in several places: ${s.repeated.length}`);
for (const x of [...s.twins, ...s.nested, ...s.repeated]) console.log(`  ${x}`);
console.log(`subjects in more than one place: ${s.scattered.length}/${s.subjects} · places per subject: ${s.placesPerSubject.toFixed(2)}`);
for (const x of s.scattered.slice(0, 15)) console.log(`  ${x.category}: ${x.places.map(([pl, n]) => `${pl} (${n})`).join(' | ')}`);
console.log(`categorize: ${ms.toFixed(0)} ms for ${proposal.candidates.length} bookmarks`);
