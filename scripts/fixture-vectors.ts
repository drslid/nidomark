// Computes, with the packaged model, the vectors of every text the extension embeds for the fictitious
// collection (with and without history, French and English, all test scenarios, and the pages as the site
// reader extracts them), so that the unit tests replay the real pipeline. Run after changing how texts are
// built: `pnpm fixtures`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env, pipeline } from '@huggingface/transformers';
import { MODEL_ID, modelInput } from '../lib/model';
import { prepare } from '../lib/pipeline';
import { loadPublicSuffixList } from '../lib/psl';
import { pageText } from '../lib/site';
import { buildSnapshot } from '../lib/snapshot';
import { corpusPages } from '../tests/fixtures/collection';
import { SCENARIOS, buildTree, corpusHistory } from '../tests/fixtures/tree';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'fixtures', 'e5-pipeline-vectors.json');
loadPublicSuffixList(fs.readFileSync(path.join(ROOT, 'lib', 'data', 'public_suffix_list.dat'), 'utf8'));

const texts = new Set<string>();
for (const move of Object.values(SCENARIOS))
  for (const history of [undefined, corpusHistory()])
    for (const lang of ['fr', 'en'])
      for (const t of prepare(buildSnapshot(buildTree(move), 1), history, ['1', '2'], lang).texts) texts.add(t);
for (const v of corpusPages().values()) if (v.kind === 'ok' && pageText(v.page)) texts.add(pageText(v.page));

env.allowRemoteModels = false;
env.localModelPath = path.join(ROOT, 'public', 'models') + path.sep;
const extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8' });
const out: Record<string, string> = {};
let n = 0;
for (const t of [...texts].sort()) {
  const tensor = await extractor(modelInput(t), { pooling: 'mean', normalize: true });
  out[t] = Buffer.from(new Float32Array(tensor.data as Float32Array).buffer).toString('base64');
  if (++n % 50 === 0) console.log(`${n}/${texts.size}`);
}
fs.writeFileSync(OUT, `${JSON.stringify({ model: MODEL_ID, vectors: out })}\n`);
console.log(`${texts.size} vectors written to ${path.relative(ROOT, OUT)}`);
