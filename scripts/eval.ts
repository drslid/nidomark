// Prints how the classifier files the fictitious collection with the real pipeline vectors.
// Usage: pnpm eval [--detail]   (CLASSIFY='{"zLink":1.2}' to try other options)
import { classify } from '../lib/classify';
import { EXPECTED, buildInput, placementNames } from '../tests/fixtures/collection';
import type { InputOptions } from '../tests/fixtures/collection';

const options = process.env.CLASSIFY ? JSON.parse(process.env.CLASSIFY) : undefined;
const detail = process.argv.includes('--detail');
const runs: [string, InputOptions][] = [
  ['no history, fr', { history: false, lang: 'fr' }],
  ['history,    fr', { history: true, lang: 'fr' }],
  ['no history, en', { history: false, lang: 'en' }],
  ['history,    en', { history: true, lang: 'en' }],
];
const translate: Record<string, string> = { 'Home services': 'Services maison', 'Self-hosting': 'Auto-hébergement', 'Web development': 'Développement web', Travel: 'Voyages', Paperwork: 'Démarches' };

for (const [label, o] of runs) {
  const input = buildInput({ ...o, options });
  const p = classify(input);
  const names = placementNames(p, input);
  const ok = Object.entries(EXPECTED).filter(([id, f]) => (translate[names[id] ?? ''] ?? names[id]) === f);
  const created = p.newFolders.map((f) => `${f.emoji} ${f.name}${f.vocabId ? '' : '*'}`).join(', ');
  console.log(`${label}: ${ok.length}/${Object.keys(EXPECTED).length} · new: ${created}`);
  if (detail) for (const [id, f] of Object.entries(EXPECTED)) {
    const got = translate[names[id] ?? ''] ?? names[id];
    if (got === f) continue;
    const reason = p.placements.find((x) => x.bookmarkId === id)?.reason;
    console.log(`   ✗ ${id.padEnd(4)} ${(input.snapshot.bookmarks.get(id)?.title ?? '').slice(0, 42).padEnd(42)} → ${String(got).padEnd(18)} ref ${f.padEnd(18)} ${reason ? `${reason.key} ${reason.subs?.join(' | ') ?? ''}` : ''}`);
  }
}
