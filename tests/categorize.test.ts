import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { type CategorizeInput, categorize, scopeCandidates } from '../lib/categorize';
import { prepare } from '../lib/pipeline';
import type { SiteVerdict } from '../lib/site';
import { buildSnapshot, type TreeNode } from '../lib/snapshot';
import type { Usage } from '../lib/types';
import { destinationsOf, run } from './fixtures/collection';
import { EXPECTED_DEST } from './fixtures/tree';

describe('the fictitious collection', () => {
  it('files nearly everything where a person would look for it once pages are read', () => {
    const { proposal, snapshot } = run({ pages: true });
    const dest = destinationsOf(proposal, snapshot);
    const wrong = Object.entries(EXPECTED_DEST).filter(([id, expected]) => dest[id] !== expected).map(([id]) => `${id}: ${dest[id]}`);
    expect(wrong.length, wrong.join(', ')).toBeLessThanOrEqual(1);
  });

  it('keeps the folders that make sense and empties the catch-all ones', () => {
    const { proposal, snapshot } = run({ pages: true });
    const dest = destinationsOf(proposal, snapshot);
    expect([dest.m1, dest.m2, dest.m3]).toEqual(['(reste)', '(reste)', '(reste)']);
    expect(dest.v1).toBe('Loisirs › Streaming');
    expect(dest.v2).toBe('Tech › Actu tech');
    expect(dest.v3).toBe('Recettes');
    expect(dest.b5).toBe('(reste)');
  });

  it('never files on a guess: without reading pages, unclear bookmarks are left to check', () => {
    const { proposal } = run({});
    const reasons = new Map(proposal.review.map((r) => [r.bookmarkId, r.reason.key]));
    expect(reasons.get('v3')).toBe('reviewNoAccess');
    const filed = new Map(proposal.placements.map((p) => [p.bookmarkId, p.reason.key]));
    expect(filed.get('v1')).toBe('reasonKnownSite');
  });

  it('only covers the chosen folders, and never the shortcuts of the bookmarks bar', () => {
    const snapshot = buildSnapshot(buildTreeForScope(), 1);
    const p = prepare(snapshot, undefined, ['1', '2'], 'fr');
    expect(p.candidates).not.toContain('bar-shortcut');
    expect(p.candidates).toContain('bar-folder-item');
    expect(p.candidates).not.toContain('in-backup');
    expect(prepare(snapshot, undefined, ['f-sub'], 'fr').candidates).toEqual(['bar-folder-item']);
  });
});

function buildTreeForScope(): TreeNode[] {
  return [{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [
      { id: 'bar-shortcut', title: 'Gmail', url: 'https://mail.google.com/' },
      { id: 'f-sub', title: 'Travail', children: [{ id: 'bar-folder-item', title: 'Jira', url: 'https://acme.atlassian.net/' }] },
    ] },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
      { id: 'f-backup', title: 'Nidomark – sauvegarde du 01/11/2026 10:00', children: [{ id: 'in-backup', title: 'Netflix', url: 'https://www.netflix.com/' }] },
    ] },
  ] }];
}

// --- Rules, on small collections without the model ---------------------------------------------------------

interface Item { id: string; title: string; url: string }
interface Folder { id: string; title: string; children: Item[] }
function input(other: (Item | Folder)[], o: Partial<CategorizeInput> = {}, bar: (Item | Folder)[] = []): CategorizeInput {
  const node = (x: Item | Folder): TreeNode => ('children' in x ? { id: x.id, title: x.title, children: x.children.map(node) } : { id: x.id, title: x.title, url: x.url });
  const snapshot = buildSnapshot([{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: bar.map(node) },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: other.map(node) },
  ] }], 1);
  const p = prepare(snapshot, undefined, ['1', '2'], 'fr');
  return {
    snapshot, features: p.features, candidates: p.candidates, vectors: new Map(), pageVectors: new Map(), prototypes: new Map(), labeled: [],
    usageVectors: {} as Record<Usage, Float32Array>, folderVectors: new Map(), sites: new Map(), siteReading: true, examples: new Map(), known: new Map(),
    destination: 'bar', lang: 'fr', ...o,
  };
}
const where = (i: CategorizeInput) => {
  const { proposal } = categorize(i);
  return { proposal, dest: destinationsOf(proposal, i.snapshot), folder: (key: string) => proposal.newFolders.find((f) => f.key === key) };
};

describe('rules', () => {
  it('files adult content in its own folder, out of the bookmarks bar, even from a folder of the user', () => {
    const r = where(input([{ id: 'f-videos', title: 'Vidéos', children: [{ id: 'x1', title: 'Vidéo', url: 'https://fr.pornhub.com/view_video.php?viewkey=1' }] }]));
    expect(r.dest.x1).toBe('Porn');
    expect(r.folder('c:adult')?.parentId).toBe('2');
  });

  it('files pirate streaming sites by their name', () => {
    const r = where(input([{ id: 's1', title: 'Film complet', url: 'https://www.french-stream.pink/films/123' }]));
    expect(r.dest.s1).toBe('Streaming');
  });

  it('files sites that no longer answer, but not home services nor big sites that failed to connect', () => {
    const sites = new Map<string, SiteVerdict>([
      ['d1', { kind: 'dead', reason: 'gone', status: 404 }],
      ['d2', { kind: 'dead', reason: 'network' }],
      ['d3', { kind: 'dead', reason: 'network' }],
      ['d4', { kind: 'dead', reason: 'parked' }],
    ]);
    const r = where(input([
      { id: 'd1', title: 'Vieil article', url: 'https://blog.example.org/2012/article' },
      { id: 'd2', title: 'NAS', url: 'http://192.168.1.2:5000/' },
      { id: 'd3', title: 'Netflix', url: 'https://www.netflix.com/browse' },
      { id: 'd4', title: 'Mon ancien site', url: 'https://ancien-site.example/' },
    ], { sites }));
    expect(r.dest.d1).toBe('Sites inaccessibles');
    expect(r.dest.d4).toBe('Sites inaccessibles');
    expect(r.dest.d2).toBe('Services maison');
    expect(r.dest.d3).toBe('Streaming');
    expect(r.folder('c:dead')?.parentId).toBe('2');
    expect(r.proposal.placements.find((p) => p.bookmarkId === 'd1')?.reason).toEqual({ key: 'deadGone', subs: ['404'] });
  });

  it('gives a single category its own name, and groups several under one folder', () => {
    const one = where(input([{ id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' }]));
    expect(one.dest.n1).toBe('Streaming');
    const many = where(input([
      { id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' },
      { id: 'n2', title: 'Spotify', url: 'https://open.spotify.com/' },
      { id: 'n3', title: 'Deezer', url: 'https://www.deezer.com/' },
      { id: 'n4', title: 'Steam', url: 'https://store.steampowered.com/' },
    ]));
    expect(many.dest).toMatchObject({ n1: 'Loisirs › Streaming', n2: 'Loisirs › Musique', n3: 'Loisirs › Musique', n4: 'Loisirs' });
  });

  it('recognises its own emoji-only folders and moves a loose bookmark into the new subfolder of its category', () => {
    const leisure: Folder = { id: 'f-loisirs', title: '🎬', children: [{ id: 'old', title: 'Canal+', url: 'https://www.canalplus.com/' }] };
    const r = where(input([], {}, [leisure]));
    expect(r.dest.old).toBe('(reste)');
    const r2 = where(input([{ id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' }], {}, [leisure]));
    expect(r2.dest.n1).toBe('Streaming');
    expect(r2.dest.old).toBe('Streaming');
    expect(r2.folder('c:streaming')?.parentId).toBe('f-loisirs');
  });

  it('follows the user: a bookmark they filed stays, and its site follows it', () => {
    const examples = new Map([['e1', 'f-mine']]);
    const r = where(input([
      { id: 'f-mine', title: 'Abonnements', children: [{ id: 'e1', title: 'Netflix', url: 'https://www.netflix.com/browse' }] },
      { id: 'e2', title: 'Netflix – Ma liste', url: 'https://www.netflix.com/browse/my-list' },
    ], { examples }));
    expect(r.dest.e1).toBe('(reste)');
    expect(r.dest.e2).toBe('Abonnements');
  });

  it('reads the page of an unclear bookmark when allowed, and says so otherwise', () => {
    const items = [{ id: 'q1', title: 'Accueil', url: 'https://www.inconnu.example/' }];
    expect(categorize(input(items)).assessments.get('q1')?.unclear).toBe(true);
    expect(categorize(input(items)).proposal.review[0]?.reason.key).toBe('reviewVague');
    expect(categorize(input(items, { siteReading: false })).proposal.review[0]?.reason.key).toBe('reviewNoAccess');
    const blocked = categorize(input(items, { sites: new Map([['q1', { kind: 'blocked', status: 403 }]]) }));
    expect(blocked.proposal.review[0]?.reason).toEqual({ key: 'reviewBlocked', subs: ['403'] });
  });
});

describe('scope', () => {
  it('lets a subfolder be left out of a chosen folder, the nearest choice deciding', () => {
    const snapshot = buildSnapshot([{ id: '0', title: '', children: [
      { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [] },
      { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
        { id: 'a', title: 'A', url: 'https://a.example/' },
        { id: 'f1', title: 'Perso', children: [{ id: 'b', title: 'B', url: 'https://b.example/' }, { id: 'f2', title: 'Garder', children: [{ id: 'c', title: 'C', url: 'https://c.example/' }] }] },
      ] },
    ] }], 1);
    const all = { has: () => true };
    expect(scopeCandidates(snapshot, all, ['2'], ['f1']).sort()).toEqual(['a']);
    expect(scopeCandidates(snapshot, all, ['2', 'f2'], ['f1']).sort()).toEqual(['a', 'c']);
    expect(scopeCandidates(snapshot, all, ['f1'], []).sort()).toEqual(['b', 'c']);
  });
});
