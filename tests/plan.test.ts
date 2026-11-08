import { describe, expect, it } from 'vitest';
import { type BookmarksApi, type Decisions, type FolderStyle, UnresolvedJournalError, applyPlan, buildPlan, defaultDecisions, folderTitle, keepInterrupted, undoLast } from '../lib/plan';
import { buildTree, run } from './fixtures/collection';
import { FakeBookmarks, MemoryJournal } from './fixtures/fake-bookmarks';

const BACKUP = { parentId: '2', title: 'Nidomark – sauvegarde du 08/11/2026 14:10', sources: [{ id: '1', title: 'Barre de favoris' }, { id: '2', title: 'Autres favoris' }] };

function setup(crashAfter = Infinity, o: { backup?: boolean; dupes?: boolean; style?: FolderStyle; edit?: (d: Decisions) => void } = {}) {
  const api = new FakeBookmarks(buildTree());
  const { proposal } = run({ history: true, pages: true, destination: 'other' });
  const decisions = defaultDecisions(proposal, o.style ?? 'emoji-name', ['b1', 'b2']);
  // Removed bookmarks come back with a new id: most tests compare ids, so they keep the duplicates.
  if (!o.dupes) decisions.removes = {};
  o.edit?.(decisions);
  const current = {
    node: (id: string) => {
      const n = api.nodes.get(id);
      return n ? { parentId: n.parentId, title: n.title, url: n.url } : undefined;
    },
    roots: new Set(['1', '2']),
    destinationRoot: '2',
  };
  const ops = buildPlan(proposal, decisions, current, o.backup ? BACKUP : undefined);
  return { api, ops, proposal, initial: api.state(), store: new MemoryJournal(api, crashAfter) };
}

const childTitles = (api: FakeBookmarks, id: string) => (api.nodes.get(id)?.children ?? []).map((c) => api.nodes.get(c)?.title);
const folderNamed = (api: FakeBookmarks, title: string) => [...api.nodes.values()].find((n) => n.title === title && !n.url);

describe('folder titles', () => {
  it('follows the chosen style', () => {
    expect(folderTitle('Voyages', '✈️', 'name')).toBe('Voyages');
    expect(folderTitle('Voyages', '✈️', 'emoji-name')).toBe('✈️ Voyages');
    expect(folderTitle('Voyages', '✈️', 'emoji')).toBe('✈️');
  });
});

describe('apply and undo', () => {
  it('applies the proposal, then restores an identical tree', async () => {
    const { api, ops, initial, store } = setup();
    const res = await applyPlan(api, ops, store);
    expect(res.skipped).toEqual([]);
    const other = childTitles(api, '2');
    expect(other).toContain('🖥️ Services maison');
    expect(other).toContain('✈️ Voyages');
    expect(other).toContain('💡 Domotique');
    expect(childTitles(api, folderNamed(api, '💻 Tech')?.id as string)).toEqual(expect.arrayContaining(['👨‍💻 Développement', '📡 Actu tech', '🗄️ Auto-hébergement']));
    expect(api.nodes.get('b1')?.title).toBe('');
    expect(api.nodes.get('u22')?.parentId).toBe('f-domotique');
    expect(api.state()).not.toBe(initial);

    const undo = await undoLast(api, store);
    expect(undo.skipped).toEqual([]);
    expect(api.state()).toBe(initial);
  });

  it('never overwrites a change made after the sort', async () => {
    const { api, ops, store } = setup();
    await applyPlan(api, ops, store);
    await api.move('u1', { parentId: 'f-domotique' });
    const undo = await undoLast(api, store);
    expect(undo.skipped.map((s) => s.reason)).toEqual(['changed']);
    expect(api.nodes.get('u1')?.parentId).toBe('f-domotique');
    expect(api.nodes.get('u2')?.parentId).toBe('2');
  });

  it('keeps a created folder that the user renamed after the sort', async () => {
    const { api, ops, store } = setup();
    await applyPlan(api, ops, store);
    const folder = folderNamed(api, '✈️ Voyages');
    await api.update(folder?.id as string, { title: 'Mes voyages' });
    const undo = await undoLast(api, store);
    expect(undo.skipped.map((s) => s.reason)).toEqual(['changed']);
    expect(folderNamed(api, 'Mes voyages')).toBeDefined();
    expect(api.nodes.get('u27')?.parentId).toBe('2');
  });

  it('skips operations whose bookmark changed during the review, URL included', async () => {
    const { api, ops, store } = setup();
    await api.update('u20', { title: 'Pain maison (modifié)' });
    await api.update('u21', { url: 'https://example.org/gateau' });
    const res = await applyPlan(api, ops, store);
    expect(res.skipped.map((s) => [(s.op as { id?: string }).id, s.reason]).sort()).toEqual([['u20', 'changed'], ['u21', 'changed'], ['u21', 'changed']]);
    expect(api.nodes.get('u20')?.parentId).toBe('2');
    expect(api.nodes.get('u21')?.parentId).toBe('2');
  });

  it('reports instead of failing when the browser refuses an operation', async () => {
    const { api, store } = setup();
    const broken: BookmarksApi = { get: api.get.bind(api), getChildren: api.getChildren.bind(api), create: api.create.bind(api), update: api.update.bind(api), remove: api.remove.bind(api), removeTree: api.removeTree.bind(api), move: async () => { throw new Error("Can't modify the root bookmark folders."); } };
    const res = await applyPlan(broken, [{ type: 'move', id: 'u1', to: { folderId: 'f-domotique' }, expect: { parentId: '2', title: 'Jellyfin', url: 'https://jellyfin.maison-dupont.fr/web/#/home.html' } }], store);
    expect(res.done).toBe(0);
    expect(res.skipped[0]?.reason).toContain('root');
  });
});

describe('interrupted runs', () => {
  it.each([1, 2, 5, 12])('undoes everything after a crash following change #%i', async (n) => {
    const { api, ops, initial, store } = setup(n);
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    // Moves are journaled by batches: the crash comes at the next save, the journal says what may have happened.
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
    const { api, ops, initial, store } = setup(4);
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

describe('folders', () => {
  it('names top-level folders with an emoji only and subfolders in full', async () => {
    const { api, ops, store } = setup(Infinity, { style: 'emoji' });
    await applyPlan(api, ops, store);
    const other = childTitles(api, '2');
    expect(other).toEqual(expect.arrayContaining(['🖥️', '✈️', '💻']));
    // The user's own folders keep their names: an emoji is only added in front.
    expect(other).toEqual(expect.arrayContaining(['💡 Domotique', '🍳 Recettes']));
    expect(childTitles(api, folderNamed(api, '💻')?.id as string)).toEqual(expect.arrayContaining(['👨‍💻 Développement']));
  });

  it('creates no subfolder of a group folder the user declined', () => {
    const { ops, proposal } = setup(Infinity, { edit: (d) => { (d.newFolders['g:tech'] as { accepted: boolean }).accepted = false; } });
    const creates = ops.flatMap((o) => (o.type === 'createFolder' ? [o.key] : []));
    expect(creates).not.toContain('g:tech');
    expect(creates).not.toContain('c:dev');
    const devIds = proposal.placements.filter((p) => p.target.kind === 'new' && p.target.key === 'c:dev').map((p) => p.bookmarkId);
    expect(devIds.length).toBeGreaterThan(0);
    expect(ops.some((o) => o.type === 'move' && devIds.includes(o.id))).toBe(false);
  });
});

describe('backup', () => {
  const backupFolder = (api: FakeBookmarks) => folderNamed(api, BACKUP.title);

  it('copies the whole tree first, then undo removes the copy with the rest', async () => {
    const { api, ops, initial, store } = setup(Infinity, { backup: true });
    expect(ops[0]?.type).toBe('backup');
    const res = await applyPlan(api, ops, store);
    expect(res.skipped).toEqual([]);
    const copy = backupFolder(api);
    expect(copy?.parentId).toBe('2');
    expect(childTitles(api, copy?.id as string)).toEqual(['Barre de favoris', 'Autres favoris']);
    const copiedOther = [...api.nodes.values()].find((n) => n.parentId === copy?.id && n.title === 'Autres favoris');
    // Same folders and bookmarks as before the sort, in the same order.
    const original = new FakeBookmarks(buildTree());
    expect(childTitles(api, copiedOther?.id as string)).toEqual(childTitles(original, '2'));
    const urls = (id: string, a: FakeBookmarks): string[] => (a.nodes.get(id)?.children ?? []).flatMap((c) => { const n = a.nodes.get(c); return n?.url ? [n.url] : n ? urls(n.id, a) : []; });
    expect(urls(copiedOther?.id as string, api).sort()).toEqual(urls('2', original).sort());

    const undo = await undoLast(api, store);
    expect(undo.skipped).toEqual([]);
    expect(api.state()).toBe(initial);
  });

  it('keeps a backup the user changed', async () => {
    const { api, ops, store } = setup(Infinity, { backup: true });
    await applyPlan(api, ops, store);
    const copy = backupFolder(api);
    await api.create({ parentId: copy?.id as string, title: 'Ma note', url: 'https://example.org/' });
    const undo = await undoLast(api, store);
    expect(undo.skipped.map((s) => s.reason)).toEqual(['changed']);
    expect(backupFolder(api)).toBeDefined();
  });

  it('removes a backup cut short by a crash', async () => {
    const { api, ops, initial, store } = setup(5, { backup: true });
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    store.restart();
    await undoLast(api, store);
    expect(backupFolder(api)).toBeUndefined();
    expect(api.state()).toBe(initial);
  });
});

describe('duplicates', () => {
  /** The tree as the user sees it: titles and addresses in order, whatever the ids. */
  const shape = (api: FakeBookmarks, id = '0'): unknown => {
    const n = api.nodes.get(id);
    return n?.url ? `${n.title} <${n.url}>` : { [n?.title ?? '']: (n?.children ?? []).map((c) => shape(api, c)) };
  };

  it('removes the copies after backing them up, and undo puts them back in place', async () => {
    const { api, ops, store } = setup(Infinity, { backup: true, dupes: true });
    const before = shape(api);
    const removed = ops.flatMap((o) => (o.type === 'remove' ? [o.id] : []));
    expect(removed.sort()).toEqual(['v4', 'v5', 'v6']);
    await applyPlan(api, ops, store);
    for (const id of removed) expect(api.nodes.has(id)).toBe(false);
    const copy = folderNamed(api, BACKUP.title);
    const inCopy = JSON.stringify(shape(api, copy?.id));
    expect(inCopy).toContain('https://netflix.com/browse/');
    expect(inCopy).toContain('utm_source=twitter');
    await undoLast(api, store);
    expect(shape(api)).toEqual(before);
  });

  it('keeps a duplicate the user chose to move', () => {
    const { ops } = setup(Infinity, { dupes: true, edit: (d) => { d.moves.v4 = { accepted: true, target: { kind: 'existing', folderId: 'f-recettes' } }; d.removes.v4 = false; } });
    expect(ops.some((o) => o.type === 'remove' && o.id === 'v4')).toBe(false);
    expect(ops.some((o) => o.type === 'move' && o.id === 'v4')).toBe(true);
  });
});
