// Prints where the categorizer files each bookmark of the fictitious collection, and why.
// Usage: pnpm eval [--pages] [--history] [--en] [--detail]
import { corpus } from '../tests/fixtures/corpus.js';
import { EXPECTED_DEST } from '../tests/fixtures/tree';
import { destinationsOf, run } from '../tests/fixtures/collection';

const args = new Set(process.argv.slice(2));
const { proposal, snapshot } = run({ pages: args.has('--pages'), history: args.has('--history'), lang: args.has('--en') ? 'en' : 'fr', options: process.env.NIDO_OPTS ? JSON.parse(process.env.NIDO_OPTS) : undefined });
const dest = destinationsOf(proposal, snapshot);
const reasons = new Map(proposal.placements.map((p) => [p.bookmarkId, `${p.reason.key}${p.reason.subs?.length ? ` (${p.reason.subs.join(', ')})` : ''}`]));
let ok = 0;
let total = 0;
for (const b of corpus) {
  if (!(b.id in dest)) continue;
  const expected = EXPECTED_DEST[b.id];
  const good = expected === undefined || expected === dest[b.id];
  if (expected !== undefined) {
    total++;
    if (good) ok++;
  }
  if (args.has('--detail') || !good) console.log(`${good ? '  ' : '✗ '}${b.id.padEnd(4)} ${b.title.slice(0, 44).padEnd(45)} → ${String(dest[b.id]).padEnd(28)} ${good ? '' : `(attendu : ${expected}) `}${reasons.get(b.id)}`);
}
console.log(`\n${ok}/${total} as expected · new folders: ${proposal.newFolders.map((f) => (f.parentKey ? `  ${f.name}` : f.name)).join(', ')}`);
