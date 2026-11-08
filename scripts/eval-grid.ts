// Grid search of the categorizer options on the fictitious collection: how many bookmarks land where the
// hand-written reference expects them, with and without reading pages and history. Usage: pnpm exec jiti scripts/eval-grid.ts
import type { CategorizeOptions } from '../lib/categorize';
import { destinationsOf, run } from '../tests/fixtures/collection';
import { EXPECTED_DEST } from '../tests/fixtures/tree';

const grid: Partial<CategorizeOptions>[] = [];
for (const margin of [0.4, 0.6, 0.8])
  for (const marginPage of [0.2, 0.3, 0.45])
    for (const protoWeight of [0, 0.2, 0.4])
      for (const keywordWeight of [0.2, 0.4, 0.6]) grid.push({ margin, marginPage, protoWeight, keywordWeight });

const score = (options: Partial<CategorizeOptions>) => {
  let total = 0;
  for (const pages of [true, false])
    for (const history of [false, true]) {
      const { proposal, snapshot } = run({ pages, history, options });
      const dest = destinationsOf(proposal, snapshot);
      total += Object.entries(EXPECTED_DEST).filter(([id, e]) => dest[id] === e).length;
    }
  return total;
};
const results = grid.map((options) => ({ options, score: score(options) })).sort((a, b) => b.score - a.score);
for (const r of results.slice(0, 10)) console.log(r.score, JSON.stringify(r.options));
console.log(`max ${Object.keys(EXPECTED_DEST).length * 4}`);
