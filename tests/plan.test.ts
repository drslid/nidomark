import { describe, expect, it } from 'vitest';
import { classify } from '../lib/classify';
import { type BookmarksApi, UnresolvedJournalError, applyPlan, buildPlan, defaultDecisions, folderTitle, keepInterrupted, undoLast } from '../lib/plan';
import { buildInput, buildTree } from './fixtures/collection';
import { FakeBookmarks, MemoryJournal } from './fixtures/fake-bookmarks';

function setup(crashAfter = Infinity) {
  const api = new FakeBookmarks(buildTree());
  const proposal = classify(buildInput({ history: true }));
  const decisions = defaultDecisions(proposal, 'emoji-name', ['b1', 'b2']);
  const current = {
    node: (id: string) => {
      const n = api.nodes.get(id);
      return n ? { parentId: n.parentId, title: n.title, url: n.url } : undefined;
    },
  };
  const ops = buildPlan(proposal, decisions, current);
  return { api, ops, initial: api.state(), store: new MemoryJournal(api, crashAfter) };
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
    expect(other).toContain('🏠 Domotique');
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
    const broken: BookmarksApi = { get: api.get.bind(api), getChildren: api.getChildren.bind(api), create: api.create.bind(api), update: api.update.bind(api), remove: api.remove.bind(api), move: async () => { throw new Error("Can't modify the root bookmark folders."); } };
    const res = await applyPlan(broken, [{ type: 'move', id: 'u1', to: { folderId: 'f-domotique' }, expect: { parentId: '2', title: 'Jellyfin', url: 'https://jellyfin.maison-dupont.fr/web/#/home.html' } }], store);
    expect(res.done).toBe(0);
    expect(res.skipped[0]?.reason).toContain('root');
  });
});

describe('interrupted runs', () => {
  it.each([1, 2, 5, 12])('undoes everything after a crash following change #%i', async (n) => {
    const { api, ops, initial, store } = setup(n);
    await expect(applyPlan(api, ops, store)).rejects.toThrow('crash');
    expect(api.mutations).toBe(n);
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
