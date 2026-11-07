import { describe, expect, it } from 'vitest';
import { classify } from '../lib/classify';
import { prepare } from '../lib/pipeline';
import { buildSnapshot } from '../lib/snapshot';
import { VOCAB } from '../lib/vocab';
import { EXPECTED, buildInput, buildTree, placementNames } from './fixtures/collection';

const EN: Record<string, string> = { 'Home services': 'Services maison', 'Self-hosting': 'Auto-hébergement', Travel: 'Voyages' };
const configs = [
  { history: false, lang: 'fr' },
  { history: true, lang: 'fr' },
  { history: false, lang: 'en' },
  { history: true, lang: 'en' },
];

describe.each(configs)('classify the fictitious collection (history: $history, $lang)', (config) => {
  const input = buildInput(config);
  const proposal = classify(input);
  const names = Object.fromEntries(Object.entries(placementNames(proposal, input)).map(([id, n]) => [id, EN[n] ?? n]));

  it('decides once for every unfiled bookmark', () => {
    expect(Object.keys(names).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('matches the hand-made reference for most bookmarks (24/31 when tuned)', () => {
    const ok = Object.entries(EXPECTED).filter(([id, folder]) => names[id] === folder);
    expect(ok.length).toBeGreaterThanOrEqual(23);
  });

  it('groups home services by usage and network location, not by subject', () => {
    for (const id of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']) expect(names[id]).toBe('Services maison');
    expect(proposal.newFolders.find((f) => f.vocabId === 'home-services')?.emoji).toBe('🖥️');
  });

  it('files guides next to what they are about', () => {
    expect(names.u22).toBe('Domotique');
    for (const id of ['u9', 'u10', 'u11']) expect(names[id]).toBe('Auto-hébergement');
    expect(names.u20).toBe('Recettes');
    expect(names.u21).toBe('Recettes');
  });

  it('creates a travel folder for the trip bookmarks', () => {
    expect(names.u27).toBe('Voyages');
    expect(names.u28).toBe('Voyages');
  });

  it('never names a folder after a kind of page instead of a subject', () => {
    const formats = new Set(VOCAB.filter((v) => v.format).map((v) => v.id));
    expect(proposal.newFolders.filter((f) => f.vocabId && formats.has(f.vocabId))).toEqual([]);
  });

  it('leaves bookmarks without enough evidence for review', () => {
    expect(names.u8).toBe('À vérifier');
    expect(names.u23).toBe('À vérifier');
  });

  it('keeps leftovers in place rather than in a catch-all usage folder', () => {
    for (const id of ['u24', 'u25']) expect(names[id]).toBe('(racine)');
  });
});

describe('collection-aware decisions', () => {
  it('proposes cleaned titles', () => {
    const p = classify(buildInput({ history: true }));
    expect(p.titles.u22).toBe('Comment installer Home Assistant en 10 minutes');
    expect(p.titles.u21).toBe('Gâteau au chocolat fondant');
    expect(p.titles.b3).toBe('Le Monde');
  });

  it('moves the dashboard next to other services when the user files by subject', () => {
    const input = buildInput({ scenario: 'topicFiler', history: true });
    expect(placementNames(classify(input), input).b1).toBe('Domotique');
  });

  it('follows the bookmarks the user filed himself', () => {
    const examples = new Map([['u13', 'f-Développement web'], ['u14', 'f-Développement web'], ['u29', 'f-Démarches'], ['u31', 'f-Démarches']]);
    const input = buildInput({ scenario: 'corrected', history: false, examples });
    expect(placementNames(classify(input), input).u15).toBe('Développement web');
  });

  it('ignores a correction once the bookmark is no longer where the user put it', () => {
    // u15 is still unfiled: a stale example pointing it to "Démarches" (an undone sort) must not pull it there.
    const examples = new Map([['u13', 'f-Développement web'], ['u14', 'f-Développement web'], ['u15', 'f-Démarches']]);
    const input = buildInput({ scenario: 'corrected', history: false, examples });
    expect(placementNames(classify(input), input).u15).toBe('Développement web');
  });

  it('never touches managed (unmodifiable) bookmarks', () => {
    const tree = buildTree();
    const root = tree[0];
    root?.children?.push({ id: 'm', parentId: '0', title: 'Managed', unmodifiable: 'managed', children: [
      { id: 'm-f', parentId: 'm', title: 'Recettes', children: [{ id: 'm-b', parentId: 'm-f', title: 'Recette de crêpes', url: 'https://example.org/crepes' }] },
    ] });
    const snapshot = buildSnapshot(tree, 1);
    expect(snapshot.folders.get('m-f')?.unmodifiable).toBe(true);
    expect(snapshot.bookmarks.get('m-b')?.unmodifiable).toBe(true);
    const p = prepare(snapshot, undefined, ['2', 'm-f'], 'fr');
    expect(p.sources).toEqual(['2']);
    expect(p.folders.map((f) => f.id)).not.toContain('m-f');
    expect(p.docIds).not.toContain('m-b');
  });

  it('suggests emoji for existing folders', () => {
    const p = classify(buildInput());
    expect(p.folderEmojis).toMatchObject({ 'f-outils': '🛠️', 'f-domotique': '🏠', 'f-recettes': '🍳', 'f-alire': '📖' });
  });
});
