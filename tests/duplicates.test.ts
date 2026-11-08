import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { findDuplicates, normalizeUrl } from '../lib/duplicates';
import { prepare } from '../lib/pipeline';
import { buildSnapshot } from '../lib/snapshot';

describe('normalizeUrl', () => {
  it('ignores what does not change the page', () => {
    const a = normalizeUrl('https://www.Example.com/page/?utm_source=x&b=2&a=1');
    expect(a).toBe(normalizeUrl('http://example.com/page?a=1&b=2'));
    expect(a).toBe('example.com/page?a=1&b=2');
  });

  it('keeps what does', () => {
    expect(normalizeUrl('https://app.example.com/#/movies')).not.toBe(normalizeUrl('https://app.example.com/#/home'));
    expect(normalizeUrl('https://example.com/A')).not.toBe(normalizeUrl('https://example.com/a'));
    expect(normalizeUrl('https://example.com:8443/')).not.toBe(normalizeUrl('https://example.com/'));
    expect(normalizeUrl('not a url')).toBeNull();
  });
});

describe('findDuplicates', () => {
  const tree = [{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [
      { id: 'bar', title: 'Le Monde', url: 'https://www.lemonde.fr/' },
    ] },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
      { id: 'f', title: 'Séries', children: [{ id: 'n1', title: 'Netflix – séries', url: 'https://www.netflix.com/browse', dateAdded: 2 }] },
      { id: 'n2', title: 'Netflix', url: 'https://netflix.com/browse/', dateAdded: 1 },
      { id: 'm1', title: 'lemonde', url: 'http://lemonde.fr' },
      { id: 'bk', title: 'Nidomark – sauvegarde du 01/11/2026', children: [{ id: 'old', title: 'Netflix', url: 'https://www.netflix.com/browse' }] },
    ] },
  ] }];

  it('keeps one copy, preferring the one outside the sort, then the most telling one', () => {
    const snapshot = buildSnapshot(tree, 1);
    const p = prepare(snapshot, undefined, ['1', '2'], 'fr');
    const dupes = findDuplicates(snapshot, p.features, p.candidates);
    expect(dupes.sort((a, b) => a.bookmarkId.localeCompare(b.bookmarkId))).toEqual([
      { bookmarkId: 'm1', keepId: 'bar' },
      { bookmarkId: 'n2', keepId: 'n1' },
    ]);
  });
});
