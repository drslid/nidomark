import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { categorize } from '../lib/categorize';
import { bookmarksUnder, fileAsSuggested, foldersUnder, mergeAnalysis, sessionLearned, suggestionTarget, userFolder } from '../lib/edit';
import { type Decisions, defaultDecisions, newTree } from '../lib/plan';
import type { NewFolder, Proposal, Target } from '../lib/types';
import { buildInput, run } from './fixtures/collection';

const ctx = { lang: 'fr', destinationRoot: '1', otherRoot: '2', localName: (x: { fr: string }) => x.fr };
const treeOf = (p: Proposal, d: Decisions) => newTree(p, d, { barId: '1', defaultRoot: '2' });
const nf = (key: string): Target => ({ kind: 'new', key });
const folder = (key: string, parentKey?: string, parentId = '1'): NewFolder => ({ key, vocabId: key.startsWith('c:') ? key.slice(2) : null, name: key, emoji: '', parentId: parentKey ? '' : parentId, parentKey, reason: { key: 'x' } });
const proposalOf = (folders: NewFolder[], placements: [string, Target][], review: string[] = []): Proposal => ({
  snapshotTakenAt: 0,
  candidates: placements.map(([id]) => id),
  duplicates: [],
  placements: placements.map(([bookmarkId, target]) => ({ bookmarkId, target, reason: { key: 'reasonModel' } })),
  newFolders: folders,
  review: review.map((bookmarkId) => ({ bookmarkId, reason: { key: 'reviewUnclear' } })),
  titles: {},
  folderEmojis: {},
  quickAccess: [],
  suggestions: Object.fromEntries(review.map((id) => [id, ['dev']])),
});
const own = (d: Decisions, key: string, name: string, parent: Parameters<typeof userFolder>[2]) => {
  const f = userFolder(key, name, parent);
  d.userFolders.push(f);
  d.newFolders[key] = { accepted: true, name, emoji: f.emoji };
};

describe('suggestions', () => {
  it('lead to the folder of the category, the user’s own first, else to a new one inside its group', () => {
    const { proposal } = run({ pages: true });
    const d = defaultDecisions(proposal, 'emoji');
    expect(suggestionTarget(treeOf(proposal, d), 'dev', '', ctx)?.key).toBe('c:dev');
    expect(suggestionTarget(treeOf(proposal, d), 'security', '', ctx)).toMatchObject({ key: 'c:security', path: ['Tech'], create: { parentKey: 'g:tech', level: 2 } });
    own(d, 'user-1', 'Développement web', { rootId: '1' });
    expect(suggestionTarget(treeOf(proposal, d), 'dev', '', ctx)?.key).toBe('user-1');
  });

  it('make a new folder for a category whose folder the user deleted, and leave what they moved out of it in place', () => {
    const { proposal } = run({ pages: true });
    const d = defaultDecisions(proposal, 'emoji');
    // "Travel" deleted, its bookmarks kept: they move up to the top of the bar.
    (d.newFolders['c:travel'] as { accepted: boolean }).accepted = false;
    const moved = ['u26', 'u27', 'u28'];
    expect(moved.map((id) => treeOf(proposal, d).place.get(id))).toEqual(Array(3).fill({ kind: 'bar' }));
    const s = suggestionTarget(treeOf(proposal, d), 'travel', '', ctx);
    expect(s).toMatchObject({ key: 's:travel', create: { vocabId: 'travel', parentId: '1', level: 1 } });
    fileAsSuggested(d, 'u15', s as NonNullable<typeof s>);
    fileAsSuggested(d, 'u14', s as NonNullable<typeof s>);
    const after = treeOf(proposal, d);
    expect(['u15', 'u14'].map((id) => after.place.get(id))).toEqual(Array(2).fill({ kind: 'folder', key: 's:travel' }));
    expect(moved.map((id) => after.place.get(id))).toEqual(Array(3).fill({ kind: 'bar' }));
    expect(d.userFolders.filter((f) => f.key === 's:travel')).toHaveLength(1);
    expect(after.byKey.has('c:travel')).toBe(false);
    // The next suggestion for travel leads to that folder.
    const next = suggestionTarget(after, 'travel', '', ctx);
    expect([next?.key, next?.create]).toEqual(['s:travel', undefined]);
  });

  it('make a new folder too when everything above the deleted one was deleted', () => {
    const { proposal } = run({ pages: true });
    const d = defaultDecisions(proposal, 'emoji');
    const before = treeOf(proposal, d);
    for (const id of bookmarksUnder(before, 'g:tech')) d.removes[id] = true;
    for (const k of ['g:tech', ...foldersUnder(before, 'g:tech')]) (d.newFolders[k] as { accepted: boolean }).accepted = false;
    const s = suggestionTarget(treeOf(proposal, d), 'dev', '', ctx);
    fileAsSuggested(d, 'u15', s as NonNullable<typeof s>);
    const after = treeOf(proposal, d);
    expect(after.place.get('u15')).toEqual({ kind: 'folder', key: 's:dev' });
    expect(after.byKey.get('s:dev')).toMatchObject({ rootId: '1', level: 1 });
    expect(after.byKey.has('g:tech')).toBe(false);
  });

  it('follow a folder the user removed to the folder above it', () => {
    const { proposal } = run({ pages: true });
    const d = defaultDecisions(proposal, 'emoji');
    (d.newFolders['c:dev'] as { accepted: boolean }).accepted = false;
    expect(suggestionTarget(treeOf(proposal, d), 'dev', '', ctx)).toMatchObject({ key: 'g:tech' });
  });
});

describe('a new analysis of a folder', () => {
  it('files again with the folders of the tree, adds the missing ones with their parents, and leaves the unclear in place', () => {
    const cur = proposalOf([folder('g:tech'), folder('c:dev', 'g:tech'), folder('review', undefined, '2')], [['a', nf('c:dev')], ['b', nf('review')], ['c', nf('review')], ['e', nf('review')]], ['b', 'c', 'e']);
    const fresh = proposalOf(
      [folder('g:tech'), folder('c:dev', 'g:tech'), folder('c:security', 'g:tech'), folder('g:home'), folder('c:cooking', 'g:home'), folder('review', undefined, '2')],
      [['a', nf('c:dev')], ['b', nf('c:security')], ['c', nf('c:cooking')], ['e', nf('review')]],
      ['e'],
    );
    const d = defaultDecisions(cur, 'emoji');
    const m = mergeAnalysis(cur, d, treeOf(cur, d), fresh, ['a', 'b', 'c', 'e']);
    expect(m.changed.sort()).toEqual(['b', 'c']);
    expect(m.added.map((f) => [f.key, f.parentKey ?? f.parentId])).toEqual([['c:security', 'g:tech'], ['g:home', '1'], ['c:cooking', 'g:home']]);
    expect(m.proposal.review.map((r) => r.bookmarkId)).toEqual(['e']);
    expect(m.proposal.suggestions).toEqual({ e: ['dev'] });
    expect(m.moves.has('e')).toBe(false);
  });

  it('files a category in the user’s own folder for it, and never demotes a bookmark to "To check"', () => {
    const cur = proposalOf([folder('g:tech'), folder('c:dev', 'g:tech')], [['a', nf('c:dev')], ['x', nf('c:dev')]]);
    const fresh = proposalOf([folder('g:home'), folder('c:cooking', 'g:home'), folder('review', undefined, '2')], [['a', nf('c:cooking')], ['x', nf('review')]], ['x']);
    const d = defaultDecisions(cur, 'emoji');
    own(d, 'user-1', 'Recettes', { rootId: '1' });
    const m = mergeAnalysis(cur, d, treeOf(cur, d), fresh, ['a', 'x']);
    expect(m.moves.get('a')).toEqual(nf('user-1'));
    expect(m.moves.has('x')).toBe(false);
    expect(m.added).toEqual([]);
  });

  it('learns from the bookmarks the user filed during the review, and their site', () => {
    const input = buildInput({ pages: true });
    const { proposal } = categorize(input);
    const d = defaultDecisions(proposal, 'emoji');
    own(d, 'user-1', 'Recettes', { rootId: '1' });
    d.moves.u12 = { accepted: true, target: nf('user-1') };
    const learned = sessionLearned(input.snapshot, input.features, proposal, d, treeOf(proposal, d));
    expect([...learned.urls.values()]).toEqual(['cooking']);
    const site = input.features.get('u12')?.registrable as string;
    expect(learned.domains.get(site)).toBe('cooking');
  });
});
