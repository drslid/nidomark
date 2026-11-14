import { describe, expect, it } from 'vitest';
import { bookmarksUnder, foldersUnder, userFolder } from '../lib/edit';
import { type BookmarksApi, type Decisions, type FolderDecision, type FolderStyle, type Op, UnresolvedJournalError, applyPlan, buildRebuildPlan, defaultDecisions, folderTitle, keepInterrupted, newTree, undoLast } from '../lib/plan';
import { archiveSources, pruneScope } from '../lib/pipeline';
import { buildSnapshot, type TreeNode } from '../lib/snapshot';
import type { Proposal } from '../lib/types';
import { type InputOptions, buildTree, run } from './fixtures/collection';
import { FakeBookmarks, MemoryJournal } from './fixtures/fake-bookmarks';

const ARCHIVE = 'Nidomark – sauvegarde du 08/11/2026 14:10';
const rootTitle = (id: string) => (id === '1' ? 'Barre de favoris' : 'Autres favoris');

function setup(crashAfter = Infinity, o: { style?: FolderStyle; input?: InputOptions; edit?: (d: Decisions, p: Proposal) => void } = {}) {
  const api = new FakeBookmarks(buildTree());
  const { proposal, snapshot } = run({ pages: true, ...o.input });
  const decisions = defaultDecisions(proposal, o.style ?? 'emoji', proposal.quickAccess);
  o.edit?.(decisions, proposal);
  const node = (id: string) => {
    const n = api.nodes.get(id);
    return n ? { parentId: n.parentId, title: n.title, url: n.url } : undefined;
  };
  const ops = buildRebuildPlan(proposal, decisions, { barId: '1', node, archive: { parentId: '2', title: ARCHIVE, sources: archiveSources(snapshot, ['1', '2'], [], rootTitle) } });
  return { api, ops, proposal, initial: api.state(), store: new MemoryJournal(api, crashAfter) };
}

const children = (api: FakeBookmarks, id: string) => (api.nodes.get(id)?.children ?? []).map((c) => api.nodes.get(c));
const titles = (api: FakeBookmarks, id: string) => children(api, id).map((n) => n?.title);
const folderNamed = (api: FakeBookmarks, title: string, parentId?: string) => [...api.nodes.values()].find((n) => n.title === title && !n.url && (!parentId || n.parentId === parentId));
const under = (api: FakeBookmarks, id: string): string[] => children(api, id).flatMap((n) => (!n ? [] : n.url !== undefined ? [n.id] : under(api, n.id)));
/** Addresses of the bookmarks in the new tree, the archive aside. */
const newTreeUrls = (api: FakeBookmarks) => {
  const archive = folderNamed(api, ARCHIVE)?.id;
  return ['1', '2'].flatMap((root) => children(api, root).flatMap((n) => (!n || n.id === archive ? [] : n.url !== undefined ? [n.url] : under(api, n.id).map((id) => api.nodes.get(id)?.url))));
};

describe('folder titles', () => {
  it('follows the chosen style', () => {
    expect(folderTitle('Voyages', '✈️', 'name')).toBe('Voyages');
    expect(folderTitle('Voyages', '✈️', 'emoji-name')).toBe('✈️ Voyages');
    expect(folderTitle('Voyages', '✈️', 'emoji')).toBe('✈️');
  });
});

describe('rebuild', () => {
  it('recreates the whole collection: icons first in the bar, then the folders; the old tree archived as it was', async () => {
    const { api, ops, store } = setup();
    const before = { bar: [...(api.nodes.get('1')?.children ?? [])], other: [...(api.nodes.get('2')?.children ?? [])] };
    const res = await applyPlan(api, ops, store);
    expect(res.skipped).toEqual([]);
    const bar = children(api, '1');
    expect(bar.slice(0, 3).map((n) => [n?.url, n?.title])).toEqual([
      ['http://192.168.1.20:8123/lovelace/0', ''],
      ['http://192.168.1.30:5000/', ''],
      ['https://www.lemonde.fr/', ''],
    ]);
    // Folders side by side in the bar show their emoji only; the most used come first.
    expect(bar.slice(3).map((n) => n?.title)).toEqual(['🏠', '💻', '🎬', '🏛️', '✈️', '🔧', '📰', '🗂️']);
    // Subfolders keep their name.
    expect(titles(api, folderNamed(api, '💻', '1')?.id as string)).toEqual(expect.arrayContaining(['📡 Actu tech', '🗄️ Auto-hébergement', '👨‍💻 Développement']));
    expect(titles(api, '2')).toEqual([ARCHIVE]);
    const archive = folderNamed(api, ARCHIVE)?.id as string;
    expect(titles(api, archive)).toEqual(['Barre de favoris', 'Autres favoris']);
    // The same items, in the same order: nothing of the old tree is lost or changed.
    expect(api.nodes.get(folderNamed(api, 'Barre de favoris', archive)?.id as string)?.children).toEqual(before.bar);
    expect(api.nodes.get(folderNamed(api, 'Autres favoris', archive)?.id as string)?.children).toEqual(before.other);
    // Every page once in the new tree, duplicates aside.
    expect(newTreeUrls(api)).toHaveLength(47);
    expect(new Set(newTreeUrls(api)).size).toBe(47);
  });

  it('undoes the whole sort: the same tree as before, ids included', async () => {
    const { api, ops, initial, store } = setup();
    await applyPlan(api, ops, store);
    const undo = await undoLast(api, store);
    expect(undo.skipped).toEqual([]);
    expect(api.state()).toBe(initial);
  });

  it('keeps a copy the user changed after the sort, and the folder that holds it', async () => {
    const { api, ops, store } = setup();
    await applyPlan(api, ops, store);
    const copy = [...api.nodes.values()].find((n) => n.url === 'https://www.sncf-connect.com/' && n.id !== 'u26');
    await api.update(copy?.id as string, { title: 'Train' });
    const undo = await undoLast(api, store);
    expect(undo.skipped.map((s) => s.reason).sort()).toEqual(['changed', 'not-empty']);
    expect(api.nodes.get(copy?.id as string)?.title).toBe('Train');
    expect(api.nodes.get('u26')?.parentId).toBe('2');
  });

  it('never removes a copy once its original is gone', async () => {
    const { api, ops, store } = setup();
    await applyPlan(api, ops, store);
    await api.removeTree(folderNamed(api, ARCHIVE)?.id as string);
    const undo = await undoLast(api, store);
    expect(undo.done).toBe(0);
    expect(undo.skipped.some((s) => s.reason === 'no-original')).toBe(true);
    expect(newTreeUrls(api)).toHaveLength(47);
  });

  it('leaves a bookmark changed during the review where it is, outside the archive', async () => {
    const { api, ops, store } = setup();
    await api.update('u21', { url: 'https://example.org/gateau' });
    const res = await applyPlan(api, ops, store);
    expect(res.skipped.map((s) => [s.op.type, s.reason])).toEqual([['createBookmark', 'changed'], ['move', 'changed']]);
    expect(api.nodes.get('u21')?.parentId).toBe('2');
  });

  it('hands the bookmarks of a declined subfolder to its parent', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => ((d.newFolders['c:dev'] as { accepted: boolean }).accepted = false) });
    await applyPlan(api, ops, store);
    const tech = folderNamed(api, '💻', '1')?.id as string;
    expect(titles(api, tech)).not.toContain('👨‍💻 Développement');
    expect(children(api, tech).some((n) => n?.url === 'https://caniuse.com/')).toBe(true);
  });

  it('files bookmarks to check in Other bookmarks, under their full name', async () => {
    const { api, ops, store, proposal } = setup(Infinity, { input: { pages: false } });
    expect(proposal.review.length).toBeGreaterThan(0);
    await applyPlan(api, ops, store);
    const review = folderNamed(api, '❓ À vérifier', '2');
    expect(review).toBeDefined();
    expect(under(api, review?.id as string)).toHaveLength(proposal.review.length);
  });

  it('leaves duplicates in the archive, unless the user keeps them', async () => {
    const dropped = setup();
    await applyPlan(dropped.api, dropped.ops, dropped.store);
    expect(newTreeUrls(dropped.api)).not.toContain('https://netflix.com/browse/');
    const kept = setup(Infinity, { edit: (d) => (d.removes.v4 = false) });
    await applyPlan(kept.api, kept.ops, kept.store);
    expect(newTreeUrls(kept.api)).toContain('https://netflix.com/browse/');
  });

  it('reports instead of failing when the browser refuses an operation', async () => {
    const { api, store } = setup();
    const broken: BookmarksApi = { get: api.get.bind(api), getChildren: api.getChildren.bind(api), create: api.create.bind(api), update: api.update.bind(api), remove: api.remove.bind(api), removeTree: api.removeTree.bind(api), move: async () => { throw new Error("Can't modify the root bookmark folders."); } };
    const res = await applyPlan(broken, [{ type: 'move', id: 'u1', to: { folderId: 'f-domotique' }, expect: { parentId: '2', title: 'Jellyfin', url: 'https://jellyfin.maison-dupont.fr/web/#/home.html' } }], store);
    expect(res.done).toBe(0);
    expect(res.skipped[0]?.reason).toContain('root');
  });
});

describe('edits in the review', () => {
  const folder = (d: Decisions, key: string) => d.newFolders[key] as FolderDecision;
  const urlOf = (api: FakeBookmarks, id: string) => api.nodes.get(id)?.url;

  it('moves a folder into another one, with its subfolders and bookmarks', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => (folder(d, 'g:tech').parent = { key: 'mine' }) });
    const url = urlOf(api, 'u12');
    await applyPlan(api, ops, store);
    const mine = folderNamed(api, '🗂️', '1')?.id as string;
    const tech = folderNamed(api, '💻 Tech', mine)?.id as string;
    expect(titles(api, tech).slice(0, 3)).toEqual(['📡 Actu tech', '🗄️ Auto-hébergement', '👨‍💻 Développement']);
    expect(children(api, tech).some((n) => n?.url === url)).toBe(true);
    expect(folderNamed(api, '💻', '1')).toBeUndefined();
    expect(newTreeUrls(api)).toHaveLength(47);
  });

  it('cuts a loop made by moving a folder below itself: every bookmark is still recreated once', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => (folder(d, 'g:tech').parent = { key: 'c:dev' }) });
    await applyPlan(api, ops, store);
    expect(folderNamed(api, '💻', '1')).toBeDefined();
    expect(newTreeUrls(api)).toHaveLength(47);
    expect(new Set(newTreeUrls(api)).size).toBe(47);
  });

  it('creates the folders the user made, one inside the other, even empty', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => {
      d.userFolders.push(userFolder('user-1', 'Projets', { rootId: '2' }), userFolder('user-2', 'Recettes de mamie', { key: 'user-1' }), userFolder('user-3', 'Plus tard', { key: 'user-1' }));
      for (const f of d.userFolders) d.newFolders[f.key] = { accepted: true, name: f.name, emoji: f.emoji };
      d.moves.u21 = { accepted: true, target: { kind: 'new', key: 'user-2' } };
    } });
    const url = urlOf(api, 'u21');
    await applyPlan(api, ops, store);
    const projets = folderNamed(api, '📁 Projets', '2')?.id as string;
    expect(titles(api, projets)).toEqual(['🍳 Recettes de mamie', '📁 Plus tard']);
    expect(children(api, folderNamed(api, '🍳 Recettes de mamie', projets)?.id as string).map((n) => n?.url)).toEqual([url]);
    expect(newTreeUrls(api)).toHaveLength(47);
  });

  it('removes a folder: its subfolders and bookmarks go up to the folder above', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => (folder(d, 'g:tech').accepted = false) });
    const url = urlOf(api, 'u12');
    await applyPlan(api, ops, store);
    expect(folderNamed(api, '💻', '1')).toBeUndefined();
    // At the top of the bar, the subfolders show their emoji only; the folder's own bookmark goes to the start of the bar.
    expect(titles(api, '1')).toEqual(expect.arrayContaining(['📡', '🗄️', '👨‍💻']));
    expect(children(api, '1').some((n) => n?.url === url)).toBe(true);
    expect(newTreeUrls(api)).toHaveLength(47);
  });

  it('removes a folder with what it holds: those bookmarks stay in the archive only', async () => {
    let gone: string[] = [];
    const { api, ops, store } = setup(Infinity, { edit: (d, p) => {
      const tree = newTree(p, d, { barId: '1', defaultRoot: '2' });
      const dupes = new Set(p.duplicates.map((x) => x.bookmarkId));
      gone = bookmarksUnder(tree, 'g:tech').filter((id) => !dupes.has(id));
      for (const id of gone) d.removes[id] = true;
      for (const k of ['g:tech', ...foldersUnder(tree, 'g:tech')]) folder(d, k).accepted = false;
    } });
    const urls = gone.map((id) => urlOf(api, id));
    await applyPlan(api, ops, store);
    expect(gone.length).toBeGreaterThan(10);
    expect(folderNamed(api, '💻', '1')).toBeUndefined();
    expect(newTreeUrls(api).filter((u) => urls.includes(u))).toEqual([]);
    expect(newTreeUrls(api)).toHaveLength(47 - gone.length);
    const archive = folderNamed(api, ARCHIVE)?.id as string;
    for (const id of gone) expect(api.nodes.get(id)?.parentId === archive || under(api, archive).includes(id)).toBe(true);
  });

  it('files a bookmark right in a root folder', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => (d.moves.u27 = { accepted: true, target: { kind: 'existing', folderId: '2' } }) });
    const url = urlOf(api, 'u27');
    await applyPlan(api, ops, store);
    expect(children(api, '2').some((n) => n?.url === url)).toBe(true);
    expect(newTreeUrls(api)).toHaveLength(47);
  });

  it('shows a bookmark as an icon alone only in the bar, and a folder in its own style', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (d) => {
      d.iconOnly.u26 = true;
      folder(d, 'g:tech').style = 'name';
    } });
    await applyPlan(api, ops, store);
    const travel = folderNamed(api, '✈️', '1')?.id as string;
    expect(children(api, travel).find((n) => n?.url === 'https://www.sncf-connect.com/')?.title).toBe('SNCF Connect');
    expect(titles(api, '1')).toContain('Tech');
  });
});

describe('a sort of part of the bookmarks', () => {
  it('adds to a folder of an earlier sort instead of making it again', async () => {
    const { api, ops, store } = setup(Infinity, { edit: (_d, p) => {
      const travel = p.newFolders.find((f) => f.key === 'c:travel');
      if (travel) travel.existingId = 'f-domotique';
    } });
    expect(ops.some((op) => op.type === 'createFolder' && op.key === 'c:travel')).toBe(false);
    expect(ops.filter((op) => op.type === 'createBookmark' && op.parentId === 'f-domotique')).toHaveLength(3);
    const res = await applyPlan(api, ops, store);
    expect(res.skipped).toEqual([]);
  });
});

describe('interrupted runs', () => {
  it.each([1, 2, 5, 12, 30, 60, 90, 100])('undoes everything after a crash following change #%i', async (n) => {
    const { api, ops, initial, store } = setup(n);
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    // Copies and moves are journaled by batches: the crash comes at the next save, the journal says what may have happened.
    expect(api.mutations).toBeGreaterThanOrEqual(n);
    expect((await store.load())?.status).toBe('applying');
    store.restart();
    const undo = await undoLast(api, store);
    expect(undo.skipped).toEqual([]);
    expect(api.state()).toBe(initial);
  });

  it('refuses a new run until the interrupted one is undone or kept', async () => {
    const { api, ops, store } = setup(3);
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    store.restart();
    await expect(applyPlan(api, ops, store)).rejects.toBeInstanceOf(UnresolvedJournalError);
  });

  it('can keep the changes of an interrupted run, and undo them later', async () => {
    const { api, ops, initial, store } = setup(40);
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    store.restart();
    const changed = api.state();
    await keepInterrupted(api, store);
    expect((await store.load())?.status).toBe('applied');
    expect(api.state()).toBe(changed);
    await undoLast(api, store);
    expect(api.state()).toBe(initial);
  });
});

describe('archive', () => {
  const tree = (): TreeNode[] => [{ id: '0', title: '', children: [
    { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [
      { id: 'g', index: 0, title: 'Gmail', url: 'https://mail.google.com/' },
      { id: 'work', index: 1, title: 'Travail', children: [{ id: 'deep', title: 'Projets', children: [] }] },
    ] },
    { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [
      { id: 'old', index: 0, title: 'Nidomark – sauvegarde du 01/11/2026 10:00', children: [] },
      { id: 'perso', index: 1, title: 'Perso', children: [] },
      { id: 'x', index: 2, title: 'X', url: 'https://x.com/' },
    ] },
  ] }];

  it('takes the top of each chosen root, in order, and leaves earlier backups and folders left out', () => {
    const snap = buildSnapshot(tree(), 1);
    const sources = archiveSources(snap, ['1', '2'], ['work'], rootTitle);
    expect(sources.map((s) => [s.key, s.title, s.items.map((i) => i.id)])).toEqual([
      ['archive:1', 'Barre de favoris', ['g']],
      ['archive:2', 'Autres favoris', ['perso', 'x']],
    ]);
  });

  it('takes a chosen folder whole, and only folders at the top can be chosen', () => {
    const snap = buildSnapshot(tree(), 1);
    expect(archiveSources(snap, ['perso'], [], rootTitle).map((s) => s.items.map((i) => i.id))).toEqual([['perso']]);
    expect(pruneScope(snap, ['deep', 'work', '2'])).toEqual(['work', '2']);
  });
});

describe('sorts made by version 0.2', () => {
  it('can still be undone: backup, folders, moves, renames and removals', async () => {
    const api = new FakeBookmarks(buildTree());
    const store = new MemoryJournal(api);
    const shape = () => JSON.stringify([...api.nodes.values()].filter((n) => n.url).map((n) => [n.parentId, n.title, n.url]).sort());
    const initial = shape();
    const ops: Op[] = [
      { type: 'backup', parentId: '2', title: 'Nidomark – sauvegarde du 01/11/2025 10:00', sources: [{ id: '1', title: 'Barre de favoris' }, { id: '2', title: 'Autres favoris' }] },
      { type: 'createFolder', key: 'c:travel', parentId: '2', title: '✈️ Voyages' },
      { type: 'move', id: 'u26', to: { newKey: 'c:travel' }, expect: { parentId: '2', title: 'SNCF Connect', url: 'https://www.sncf-connect.com/' } },
      { type: 'remove', id: 'v4', expect: { parentId: '2', title: 'Netflix', url: 'https://netflix.com/browse/' } },
      { type: 'rename', id: 'b1', title: '', expect: { parentId: '1', title: 'Home Assistant', url: 'http://192.168.1.20:8123/lovelace/0' }, iconOnly: true },
    ];
    const res = await applyPlan(api, ops, store);
    expect(res.skipped).toEqual([]);
    expect(shape()).not.toBe(initial);
    const undo = await undoLast(api, store);
    expect(undo.skipped).toEqual([]);
    expect(shape()).toBe(initial);
  });
});
