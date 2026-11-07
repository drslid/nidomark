// Diagnostic: similarity (z-scores) between bookmarks that the reference puts together, and their labels.
import { classify } from '../lib/classify';
import { EXPECTED, buildInput } from '../tests/fixtures/collection';

const history = process.argv.includes('--history');
let Z: ((i: number, j: number) => number) | null = null;
let idx: Map<string, number> | null = null;
let docs: { id: string; usage: string; strong: boolean; label?: string; labelZ: number }[] = [];
const input = buildInput({ history, lang: 'fr' });
input.trace = (step, data) => {
  if (step === 'similarity') { Z = data.Z as typeof Z; idx = data.idx as typeof idx; }
  if (step === 'documents') docs = data.docs as typeof docs;
  if (step === 'group') console.log('group', JSON.stringify(data));
};
classify(input);
const byId = new Map(docs.map((d) => [d.id, d]));
const groups = new Map<string, string[]>();
for (const [id, f] of Object.entries(EXPECTED)) if (!['(racine)', 'À vérifier', 'Services maison'].includes(f)) groups.set(f, [...(groups.get(f) ?? []), id]);
for (const [name, ids] of groups) {
  console.log(`\n${name}`);
  for (const id of ids) { const d = byId.get(id); console.log(`  ${id} ${input.snapshot.bookmarks.get(id)?.title.slice(0, 40)} · usage ${d?.usage}${d?.strong ? '!' : ''} · label ${d?.label} (${d?.labelZ})`); }
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
    const i = idx!.get(ids[a]!)!; const j = idx!.get(ids[b]!)!;
    console.log(`    Z(${ids[a]},${ids[b]}) = ${Z!(i, j).toFixed(2)}`);
  }
}
