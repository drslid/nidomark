import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { type CategorizeInput, MAX_LEVEL, REVIEW_KEY, categorize, scopeCandidates } from '../lib/categorize';
import { normalizeUrl } from '../lib/duplicates';
import { prepare } from '../lib/pipeline';
import type { SiteVerdict } from '../lib/site';
import { buildSnapshot, type TreeNode } from '../lib/snapshot';
import { USAGES, type Usage } from '../lib/types';
import { destinationsOf, run } from './fixtures/collection';
import { EXPECTED_DEST } from './fixtures/tree';

describe('the fictitious collection', () => {
  it('files nearly everything where a person would look for it once pages are read', () => {
    const { proposal, snapshot } = run({ pages: true });
    const dest = destinationsOf(proposal, snapshot);
    const wrong = Object.entries(EXPECTED_DEST).filter(([id, expected]) => dest[id] !== expected).map(([id]) => `${id}: ${dest[id]}`);
    expect(wrong.length, wrong.join(', ')).toBeLessThanOrEqual(1);
  });

  it('files every bookmark in the new tree: nothing stays where it was', () => {
    const { proposal } = run({ pages: true });
    expect(proposal.candidates).toHaveLength(50);
    expect(proposal.placements).toHaveLength(50);
    expect(proposal.placements.filter((p) => p.target.kind !== 'new' && p.target.kind !== 'bar')).toEqual([]);
  });

  it('keeps a personal project together and empties the catch-all folders', () => {
    const { proposal, snapshot } = run({ pages: true });
    const dest = destinationsOf(proposal, snapshot);
    expect([dest.m1, dest.m2, dest.m3]).toEqual(Array(3).fill('Mes dossiers › Mariage 2025'));
    expect([dest.v1, dest.v2, dest.v3]).toEqual(['Loisirs › Streaming', 'Tech › Actu tech', 'Maison › Recettes']);
    // A reading list with a single bookmark is not worth a folder.
    expect(dest.a1).toBe('Actualités');
  });

  it('keeps the names of the folders of an earlier sort, even named with an emoji only', () => {
    const r = where(input([{ id: 'f-tools', title: '🔧', children: [
      { id: 't1', title: 'Squoosh', url: 'https://squoosh.app/' },
      { id: 't2', title: 'TinyPNG', url: 'https://tinypng.com/' },
    ] }], { known: new Map([['f-tools', { category: 'tools', name: 'Boîte à outils' }]]) }));
    expect(r.dest.t1).toBe('Boîte à outils');
  });

  it('names folders like the user did', () => {
    const { proposal, snapshot } = run({ pages: true, scenario: 'corrected' });
    const dest = destinationsOf(proposal, snapshot);
    expect([dest.u13, dest.u14]).toEqual(['Tech › Développement web', 'Tech › Développement web']);
    expect(dest.b4).toBe('Outils');
  });

  it('separates a service from the guides about it, even filed together', () => {
    const { proposal, snapshot } = run({ pages: true, scenario: 'topicFiler' });
    const dest = destinationsOf(proposal, snapshot);
    expect(dest.u6).toBe('Maison › Services maison');
    expect([dest.d1, dest.d2]).toEqual(['Maison › Domotique', 'Maison › Domotique']);
  });

  it('puts the most visited sites first in the bar, one icon per site', () => {
    const { proposal, snapshot } = run({ pages: true, history: true });
    expect(proposal.quickAccess.slice(0, 3)).toEqual(['b1', 'b3', 'u24']);
    expect(proposal.quickAccess).toHaveLength(10);
    expect(proposal.quickAccess).toEqual(expect.arrayContaining(['b2', 'u1', 'u25']));
    // A tracking copy of a page is not a second icon.
    expect(proposal.quickAccess).not.toContain('v6');
    expect(destinationsOf(proposal, snapshot).a1).toBe('Actualités');
  });

  it('keeps the shortcuts of the bar as quick access without history', () => {
    const { proposal } = run({ pages: true });
    expect(proposal.quickAccess).toEqual(['b1', 'b2', 'b3']);
    expect(run({ pages: true, options: { quickAccess: 0 } }).proposal.quickAccess).toEqual([]);
  });

  it('adds no icon to a bookmarks bar left out of the sort', () => {
    const r = where(input([{ id: 'g1', title: 'Gmail', url: 'https://mail.google.com/' }], { hostVisits: new Map([['mail.google.com', 300]]), barInScope: false }));
    expect(r.proposal.quickAccess).toEqual([]);
    expect(r.dest.g1).not.toBe('(barre)');
  });

  it('never files on a guess: unclear bookmarks wait in "To check", out of the bar', () => {
    const { proposal } = run({});
    const reasons = new Map(proposal.review.map((r) => [r.bookmarkId, r.reason.key]));
    expect(reasons.get('v3')).toBe('reviewNoAccess');
    expect(proposal.placements.find((p) => p.bookmarkId === 'v1')?.reason.key).toBe('reasonKnownSite');
    expect(proposal.newFolders.find((f) => f.key === REVIEW_KEY)?.parentId).toBe('2');
  });

  it('suggests up to three categories for every bookmark to check, the model’s lean first, never adult content', () => {
    const { proposal } = run({});
    expect(proposal.review.length).toBeGreaterThan(0);
    for (const r of proposal.review) {
      const s = proposal.suggestions[r.bookmarkId] ?? [];
      expect(s.length, r.bookmarkId).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(3);
      expect(s).not.toContain('adult');
    }
    expect(proposal.suggestions.u14?.[0]).toBe('dev');
    expect(proposal.suggestions.u15?.[0]).toBe('dev');
    expect(Object.keys(proposal.suggestions).every((id) => proposal.review.some((r) => r.bookmarkId === id))).toBe(true);
  });

  it('builds three levels at most', () => {
    const { proposal } = run({ pages: true });
    expect(Math.max(...proposal.newFolders.map((f) => f.level ?? 1))).toBeLessThanOrEqual(MAX_LEVEL);
  });
});

describe('scope', () => {
  it('covers every bookmark of the chosen folders, bar shortcuts included, never the backups', () => {
    const snapshot = buildSnapshot(buildTreeForScope(), 1);
    const p = prepare(snapshot, undefined, ['1', '2'], 'fr');
    expect(p.candidates).toEqual(expect.arrayContaining(['bar-shortcut', 'bookmarklet', 'bar-folder-item']));
    expect(p.candidates).not.toContain('in-backup');
    // Only web pages go through the model.
    expect(p.embedded).not.toContain('bookmarklet');
    expect(prepare(snapshot, undefined, ['f-sub'], 'fr').candidates).toEqual(['bar-folder-item']);
  });

  it('lets a folder be left out of a chosen one, the nearest choice deciding', () => {
    const snapshot = buildSnapshot([{ id: '0', title: '', children: [
      { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [] },
      { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
        { id: 'a', title: 'A', url: 'https://a.example/' },
        { id: 'f1', title: 'Perso', children: [{ id: 'b', title: 'B', url: 'https://b.example/' }, { id: 'f2', title: 'Garder', children: [{ id: 'c', title: 'C', url: 'https://c.example/' }] }] },
      ] },
    ] }], 1);
    expect(scopeCandidates(snapshot, ['2'], ['f1']).sort()).toEqual(['a']);
    expect(scopeCandidates(snapshot, ['2', 'f2'], ['f1']).sort()).toEqual(['a', 'c']);
    expect(scopeCandidates(snapshot, ['f1'], []).sort()).toEqual(['b', 'c']);
  });
});

function buildTreeForScope(): TreeNode[] {
  return [{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [
      { id: 'bar-shortcut', title: 'Gmail', url: 'https://mail.google.com/' },
      { id: 'bookmarklet', title: 'Lire plus tard', url: 'javascript:void(0)' },
      { id: 'f-sub', title: 'Travail', children: [{ id: 'bar-folder-item', title: 'Jira', url: 'https://acme.atlassian.net/' }] },
    ] },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
      { id: 'f-backup', title: 'Nidomark – sauvegarde du 01/11/2026 10:00', children: [{ id: 'in-backup', title: 'Netflix', url: 'https://www.netflix.com/' }] },
    ] },
  ] }];
}

// --- Rules, on small collections without the model ---------------------------------------------------------

interface Item { id: string; title: string; url: string }
interface Folder { id: string; title: string; children: (Item | Folder)[] }
function input(other: (Item | Folder)[], o: Partial<CategorizeInput> = {}, bar: (Item | Folder)[] = []): CategorizeInput {
  const node = (x: Item | Folder): TreeNode => ('children' in x ? { id: x.id, title: x.title, children: x.children.map(node) } : { id: x.id, title: x.title, url: x.url });
  const snapshot = buildSnapshot([{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: bar.map(node) },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: other.map(node) },
  ] }], 1);
  const p = prepare(snapshot, undefined, ['1', '2'], 'fr');
  return {
    snapshot, features: p.features, candidates: p.candidates, vectors: new Map(), pageVectors: new Map(), prototypes: new Map(), labeled: [],
    usageVectors: {} as Record<Usage, Float32Array>, folderVectors: new Map(), sites: new Map(), siteReading: true, known: new Map(),
    destination: 'bar', lang: 'fr', ...o,
  };
}
const where = (i: CategorizeInput) => {
  const { proposal } = categorize(i);
  return { proposal, dest: destinationsOf(proposal, i.snapshot), folder: (key: string) => proposal.newFolders.find((f) => f.key === key) };
};
const many = (prefix: string, n: number, url: (i: number) => string, title = prefix): Item[] => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, title: `${title} ${i}`, url: url(i) }));

describe('rules', () => {
  it('files adult content in its own folder of Other bookmarks, even from a folder of the user and however visited', () => {
    const r = where(input([{ id: 'f-videos', title: 'Vidéos', children: [{ id: 'x1', title: 'Vidéo', url: 'https://fr.pornhub.com/view_video.php?viewkey=1' }] }], { hostVisits: new Map([['fr.pornhub.com', 500]]) }));
    expect(r.dest.x1).toBe('Porn');
    expect(r.folder('c:adult')?.parentId).toBe('2');
    expect(r.proposal.quickAccess).toEqual([]);
  });

  it('counts two services of one home server as two sites, and their bookmarks in the bar first', () => {
    const hostVisits = new Map([['192.168.1.30:5000', 40], ['192.168.1.30:2283', 30], ['www.example.org', 3]]);
    const r = where(input([
      { id: 'nas', title: 'NAS', url: 'http://192.168.1.30:5000/' },
      { id: 'photos', title: 'Immich', url: 'http://192.168.1.30:2283/photos' },
      { id: 'rare', title: 'Rare', url: 'https://www.example.org/' },
    ], { hostVisits }));
    expect(r.proposal.quickAccess).toEqual(['nas', 'photos']);
    expect(r.dest.rare).not.toBe('(barre)');
  });

  it('files pirate streaming sites by their name', () => {
    const r = where(input([{ id: 's1', title: 'Film complet', url: 'https://www.french-stream.pink/films/123' }]));
    expect(r.dest.s1).toBe('Streaming');
  });

  it('files sites that no longer answer apart, but not home services nor big sites that failed to connect', () => {
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
    expect([r.dest.d1, r.dest.d4]).toEqual(['Sites inaccessibles', 'Sites inaccessibles']);
    expect(r.dest.d2).toBe('Services maison');
    expect(r.dest.d3).toBe('Streaming');
    expect(r.folder('c:dead')?.parentId).toBe('2');
    expect(r.proposal.placements.find((p) => p.bookmarkId === 'd1')?.reason).toEqual({ key: 'deadGone', subs: ['404'] });
  });

  it('gives a single category its own name, and groups several under one folder', () => {
    const one = where(input([{ id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' }]));
    expect(one.dest.n1).toBe('Streaming');
    const several = where(input([
      { id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' },
      { id: 'n2', title: 'Spotify', url: 'https://open.spotify.com/' },
      { id: 'n3', title: 'Deezer', url: 'https://www.deezer.com/' },
      { id: 'n4', title: 'Steam', url: 'https://store.steampowered.com/' },
    ]));
    expect(several.dest).toMatchObject({ n1: 'Loisirs › Streaming', n2: 'Loisirs › Musique', n3: 'Loisirs › Musique', n4: 'Loisirs' });
  });

  it('splits a big category by site on a third level, and no deeper', () => {
    const r = where(input([
      ...many('nf', 5, (i) => `https://www.netflix.com/title/${i}`, 'Série'),
      ...many('pv', 5, (i) => `https://www.primevideo.com/detail/${i}`, 'Film'),
      { id: 'tw', title: 'Twitch', url: 'https://www.twitch.tv/' },
      { id: 'dp', title: 'Disney+', url: 'https://www.disneyplus.com/' },
      { id: 'sp', title: 'Spotify', url: 'https://open.spotify.com/' },
      { id: 'dz', title: 'Deezer', url: 'https://www.deezer.com/' },
    ]));
    expect(r.dest.nf0).toBe('Loisirs › Streaming › Netflix');
    expect(r.dest.pv4).toBe('Loisirs › Streaming › Primevideo');
    expect(r.dest.tw).toBe('Loisirs › Streaming');
    expect(r.folder('f:streaming:site-netflix.com')?.level).toBe(3);
  });

  it('recreates a folder of the user that makes sense, with its subfolders, and names an emoji-only one by its emoji', () => {
    const r = where(input([
      { id: 'f-lire', title: 'À lire', children: [
        { id: 'l1', title: 'Un article', url: 'https://www.example.org/article-1' },
        { id: 'l2', title: 'Un autre', url: 'https://www.example.net/article-2' },
        { id: 'f-romans', title: 'Romans', children: [
          { id: 'l3', title: 'Roman A', url: 'https://www.example.com/roman-a' },
          { id: 'l4', title: 'Roman B', url: 'https://www.example.com/roman-b' },
        ] },
      ] },
      { id: 'f-uni', title: '🦄', children: [
        { id: 'u1', title: 'Spotify', url: 'https://open.spotify.com/' },
        { id: 'u2', title: 'Deezer', url: 'https://www.deezer.com/' },
        { id: 'u3', title: 'SoundCloud', url: 'https://soundcloud.com/' },
      ] },
      { id: 'f-seul', title: 'Projet', children: [{ id: 'p1', title: 'Netflix', url: 'https://www.netflix.com/' }] },
    ]));
    expect([r.dest.l1, r.dest.l3]).toEqual(['Mes dossiers › À lire', 'Mes dossiers › À lire › Romans']);
    expect(r.dest.u1).toBe('Loisirs › Musique › 🦄');
    expect(r.folder('k:f-uni')?.emoji).toBe('');
    // A folder of one bookmark is not recreated.
    expect(r.dest.p1).toBe('Loisirs › Streaming');
  });

  it('follows the user: a bookmark they filed elsewhere, then its site, but never against adult content', () => {
    const learned = {
      urls: new Map([[normalizeUrl('https://www.netflix.com/browse') as string, 'video']]),
      domains: new Map([['cuisine-facile.example', 'cooking'], ['fr.pornhub.com', 'video']]),
    };
    const r = where(input([
      { id: 'e1', title: 'Netflix', url: 'https://www.netflix.com/browse' },
      { id: 'e2', title: 'Netflix – Ma liste', url: 'https://www.netflix.com/browse/my-list' },
      { id: 'e3', title: 'Accueil', url: 'https://cuisine-facile.example/' },
      { id: 'e4', title: 'Vidéo', url: 'https://fr.pornhub.com/view_video.php?viewkey=2' },
    ], { learned }));
    expect(r.proposal.placements.find((p) => p.bookmarkId === 'e1')?.reason.key).toBe('reasonLearned');
    expect(r.dest.e2).toBe('Loisirs › Streaming');
    expect(r.proposal.placements.find((p) => p.bookmarkId === 'e3')?.reason.key).toBe('reasonLearnedSite');
    expect(r.dest.e4).toBe('Porn');
  });

  it('keeps bookmarklets of the bar in the bar, and files other browser links apart', () => {
    const r = where(input([{ id: 's2', title: 'Réglages', url: 'chrome://settings/' }], {}, [{ id: 's1', title: 'Lire plus tard', url: 'javascript:void(0)' }]));
    expect(r.dest.s1).toBe('(barre)');
    expect(r.dest.s2).toBe('Liens du navigateur');
    expect(r.folder('special')?.parentId).toBe('2');
  });

  it('files an unclear page with the other bookmarks of its site when they agree, and reads the words of the address', () => {
    // A tiny model: the first two pages look like cooking, the others say nothing.
    const vec = (...x: number[]) => Float32Array.from([...x, 0, 0, 0, 0].slice(0, 4));
    const usageVectors = Object.fromEntries(USAGES.map((u) => [u, vec()])) as Record<Usage, Float32Array>;
    const vectors = new Map([['m1', vec(1)], ['m2', vec(1)], ['h1', vec()], ['q1', vec()]]);
    const r = where(input([
      { id: 'm1', title: 'Tarte aux pommes', url: 'https://mamie.example/tarte' },
      { id: 'm2', title: 'Fondant', url: 'https://mamie.example/fondant' },
      { id: 'm3', title: 'Accueil', url: 'https://mamie.example/' },
      { id: 'h1', title: 'Accueil', url: 'https://recettes-faciles.example/' },
      { id: 'q1', title: 'Accueil', url: 'https://www.inconnu.example/' },
    ], { prototypes: new Map([['cooking', vec(1)]]), vectors, usageVectors }));
    expect(r.dest.m1).toBe('Cuisine');
    expect([r.dest.m2, r.dest.m3, r.dest.h1]).toEqual([r.dest.m1, r.dest.m1, r.dest.m1]);
    expect(r.proposal.placements.find((p) => p.bookmarkId === 'm3')?.reason).toEqual({ key: 'reasonSameSite', subs: ['2', 'mamie.example'] });
    expect(r.proposal.review.map((x) => x.bookmarkId)).toEqual(['q1']);
  });

  it('files a partial sort in the folders an earlier sort made, without a second folder of the same kind', () => {
    const known = new Map([['f-tech', { group: 'tech' as const, name: 'Tech' }], ['f-stream', { category: 'streaming', name: 'Streaming' }], ['f-dev', { category: 'dev', name: 'Développement' }]]);
    const i = input([
      { id: 'n1', title: 'Netflix', url: 'https://www.netflix.com/' },
      { id: 'g1', title: 'GitHub', url: 'https://github.com/' },
      { id: 's1', title: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/' },
      { id: 's2', title: 'Mots de passe compromis', url: 'https://haveibeenpwned.com/Passwords' },
    ], {
      known, remaining: new Set(['f-tech', 'f-stream', 'f-dev']),
    }, [{ id: 'f-tech', title: '💻', children: [{ id: 'f-dev', title: '👨‍💻 Développement', children: [] }] }, { id: 'f-stream', title: '📺', children: [] }]);
    const r = where({ ...i, candidates: ['n1', 'g1', 's1', 's2'] });
    expect(r.folder('c:streaming')?.existingId).toBe('f-stream');
    expect(r.folder('g:tech')).toMatchObject({ existingId: 'f-tech', name: 'Tech', emoji: '💻' });
    expect(r.folder('c:dev')?.existingId).toBe('f-dev');
    // A category the earlier sort did not have goes inside its group folder, as a new folder.
    expect(r.folder('c:security')).toMatchObject({ parentKey: 'g:tech' });
    expect(r.folder('c:security')?.existingId).toBeUndefined();
    // Folders the sort archives and recreates are not reused.
    expect(where({ ...i, remaining: new Set() }).folder('c:streaming')?.existingId).toBeUndefined();
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
