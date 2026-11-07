// Grid search of classifier options on the fictitious collection (4 configurations + 2 scenario checks).
import { classify } from '../lib/classify';
import { EXPECTED, buildInput, placementNames } from '../tests/fixtures/collection';

const translate: Record<string, string> = { 'Home services': 'Services maison', 'Self-hosting': 'Auto-hébergement', 'Web development': 'Développement web', Travel: 'Voyages', Paperwork: 'Démarches' };
const configs = [{ history: false, lang: 'fr' }, { history: true, lang: 'fr' }, { history: false, lang: 'en' }, { history: true, lang: 'en' }];
const rows: { key: string; scores: number[]; total: number; extra: number; scen: string }[] = [];
for (const wKw of [1]) for (const wLab of [0.75, 1, 1.25]) for (const zLink of [1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0]) for (const zAssign of [1.2]) {
  const options = { wKw, wLab, zLink, zAssign };
  const scores: number[] = [];
  let extra = 0;
  for (const c of configs) {
    const input = buildInput({ ...c, options });
    const p = classify(input);
    const names = placementNames(p, input);
    scores.push(Object.entries(EXPECTED).filter(([id, f]) => (translate[names[id] ?? ''] ?? names[id]) === f).length);
    // New folders that the reference does not expect.
    extra += p.newFolders.filter((f) => !['Services maison', 'Auto-hébergement', 'Voyages', 'Démarches', 'Développement web'].includes(translate[f.name] ?? f.name)).length;
  }
  const a = buildInput({ scenario: 'topicFiler', history: true, options });
  const na = placementNames(classify(a), a);
  const l = buildInput({ scenario: 'corrected', history: false, options, examples: new Map([['u13', 'f-Développement web'], ['u14', 'f-Développement web'], ['u29', 'f-Démarches'], ['u31', 'f-Démarches']]) });
  const nl = placementNames(classify(l), l);
  const scen = `${na.b1 === 'Domotique' ? 'A' : '-'}${nl.u15 === 'Développement web' ? 'L' : '-'}`;
  rows.push({ key: JSON.stringify(options), scores, total: scores.reduce((x, y) => x + y, 0), extra, scen });
}
rows.sort((x, y) => y.total - x.total || x.extra - y.extra);
for (const r of rows.slice(0, 25)) console.log(`${r.total} [${r.scores.join(' ')}] extra=${r.extra} ${r.scen} ${r.key}`);
