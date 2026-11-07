import { browser } from 'wxt/browser';
import { analyze } from '../analyze';
import { Embedder } from '../embedder';
import { t, uiLanguage } from '../i18n';
import { clearVectors } from '../idb';
import { type BookmarksApi, UnresolvedJournalError, applyPlan, defaultDecisions, keepInterrupted, undoLast } from '../plan';
import { buildSnapshot, type TreeNode } from '../snapshot';
import * as store from '../storage';
import type { Target } from '../types';
import { isWebUrl } from '../url';
import { vocabForTitle } from '../vocab';
import { announce, h, icon, replaceKeepingFocus } from './dom';
import { drawWires, planFor, reviewToolbar, reviewView } from './review';
import { bookmarkTitle } from './sheet';
import { type SettingsData, settingsView } from './settings';
import type { Actions, State } from './state';
import { destinations } from './viewmodel';
import { doneView, messageView, progressView, startView } from './views';

const api = browser.bookmarks as unknown as BookmarksApi;

export class App implements Actions {
  private state: State;
  private embedder = new Embedder();
  private settingsData: SettingsData = { folders: [] };
  private userFolders = 0;
  /** Focus to restore after the next render (data-focus key). */
  private focusNext: string | null = null;

  constructor(private root: HTMLElement) {
    this.state = {
      tab: 'organize', view: 'start', settings: store.DEFAULT_SETTINGS, useHistory: false, preview: null, progress: { phase: 'reading', done: 0, total: 0 },
      analysis: null, decisions: null, selected: null, wiresDrawn: false, changedDuringReview: false, result: null, error: null, lastJournal: null, iconOnlyCount: 0, status: '',
    };
  }

  async init(): Promise<void> {
    document.title = t('extShortName');
    document.documentElement.lang = uiLanguage().split('-')[0] ?? 'en';
    const [settings, useHistory, lastJournal, names] = await Promise.all([store.loadSettings(), store.hasHistoryPermission(), store.journalStore.load(), store.loadIconOnlyNames()]);
    Object.assign(this.state, { settings, useHistory, lastJournal, iconOnlyCount: Object.keys(names).length });
    const onChange = () => {
      if (this.state.view === 'review') this.set({ changedDuringReview: true });
      else if (this.state.view === 'start') void this.loadPreview();
    };
    for (const ev of [browser.bookmarks.onCreated, browser.bookmarks.onRemoved, browser.bookmarks.onChanged, browser.bookmarks.onMoved]) ev.addListener(onChange);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.state.selected || document.querySelector('.menu:popover-open, dialog[open]')) return;
      this.select(null);
    });
    void document.fonts?.ready.then(() => this.render());
    await this.loadPreview();
  }

  private set(patch: Partial<State>): void {
    Object.assign(this.state, patch);
    this.render();
  }

  private render(): void {
    const s = this.state;
    const review = s.tab === 'organize' && s.view === 'review' && s.analysis && s.decisions;
    const header = h('header', { class: 'appbar' },
      s.tab === 'settings' ? h('button', { class: 'icon-btn', 'aria-label': t('back'), title: t('back'), 'data-focus': 'back', onclick: () => this.setTab('organize') }, icon('arrow_back')) : null,
      h('div', { class: 'brand' }, h('img', { src: '/icon/48.png', alt: '' }), h('span', null, t('extShortName'))),
      h('span', { class: 'spacer' }),
      review ? reviewToolbar(s, this) : null,
      s.tab === 'organize' ? h('button', { class: 'icon-btn', 'aria-label': t('tabSettings'), title: t('tabSettings'), 'data-focus': 'settings', onclick: () => this.setTab('settings') }, icon('settings')) : null);
    let main: HTMLElement;
    if (s.tab === 'settings') main = h('div', { class: 'page' }, settingsView(s, this, this.settingsData));
    else if (review) main = reviewView(s, this);
    else if (s.view === 'progress') main = h('div', { class: 'page' }, progressView(s));
    else if (s.view === 'done') main = h('div', { class: 'page' }, doneView(s, this));
    else if (s.view === 'empty') main = h('div', { class: 'page' }, messageView('check_circle', t('emptyTitle'), t('emptyHint'), 'tabSettings', () => this.setTab('settings')));
    else if (s.view === 'error') main = h('div', { class: 'page' }, messageView('error', t('errorTitle'), `${s.error ?? ''}`, 'retry', () => this.backToStart()));
    else main = h('div', { class: 'page' }, startView(s, this));
    replaceKeepingFocus(this.root, h('div', null, header, h('main', null, main)));
    if (this.focusNext) {
      this.root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(this.focusNext)}"]`)?.focus({ preventScroll: true });
      this.focusNext = null;
    }
    if (review) {
      drawWires(this.root, s, !s.wiresDrawn);
      s.wiresDrawn = true;
    }
  }

  private async loadPreview(): Promise<void> {
    const snap = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
    const ids = this.state.settings.sourceFolderIds.filter((id) => snap.folders.has(id));
    if (!ids.length && snap.otherId) ids.push(snap.otherId);
    const bookmarks = ids.flatMap((id) => snap.folders.get(id)?.bookmarkIds ?? []).map((id) => snap.bookmarks.get(id)).filter((b) => !!b && isWebUrl(b.url) && !b.unmodifiable);
    const folderName = ids.map((id) => (id === snap.otherId ? t('otherFolder') : (snap.folders.get(id)?.title ?? ''))).join(', ');
    this.set({ preview: { count: bookmarks.length, folderName, urls: bookmarks.slice(0, 5).map((b) => b?.url ?? '') } });
  }

  setTab(tab: State['tab']): void {
    if (tab === 'settings') void this.loadSettingsData();
    this.focusNext = tab === 'settings' ? 'back' : 'settings';
    this.set({ tab, status: '' });
  }

  private async loadSettingsData(): Promise<void> {
    const snap = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
    const folders = [...snap.folders.values()].filter((f) => !f.unmodifiable).sort((a, b) => [...a.path, a.title].join('/').localeCompare([...b.path, b.title].join('/')));
    this.settingsData = { folders, otherId: snap.otherId, barId: snap.barId };
    this.render();
  }

  setUseHistory(on: boolean): void {
    // permissions.request must run synchronously inside the click handler.
    const op = on ? store.requestHistoryPermission() : store.removeHistoryPermission().then(() => false);
    void op.then((granted) => this.set({ useHistory: !!granted })).catch(() => this.set({ useHistory: false }));
  }

  setFolderStyle(style: State['settings']['folderStyle']): void {
    const settings = { ...this.state.settings, folderStyle: style };
    void store.saveSettings(settings);
    const d = this.state.decisions;
    if (d) {
      d.folderStyle = style;
      for (const fe of Object.values(d.folderEmojis)) fe.accepted = style !== 'name' && !!fe.emoji;
    }
    this.set({ settings, status: t('saved') });
  }

  setIconOnlyDefault(on: boolean): void {
    const settings = { ...this.state.settings, iconOnlyBar: on };
    void store.saveSettings(settings);
    this.set({ settings, status: t('saved') });
  }

  setSources(ids: string[]): void {
    const settings = { ...this.state.settings, sourceFolderIds: ids };
    void store.saveSettings(settings);
    this.set({ settings, status: t('saved') });
    void this.loadPreview();
  }

  analyze(): void {
    void this.runAnalysis();
  }

  private barDefaults(an: NonNullable<State['analysis']>): string[] {
    if (!this.state.settings.iconOnlyBar || !an.snapshot.barId) return [];
    return (an.snapshot.folders.get(an.snapshot.barId)?.bookmarkIds ?? []).filter((id) => an.snapshot.bookmarks.get(id)?.title);
  }

  private async runAnalysis(): Promise<void> {
    this.set({ tab: 'organize', view: 'progress', progress: { phase: 'reading', done: 0, total: 0 }, changedDuringReview: false, error: null, selected: null });
    try {
      const examples = await store.loadExamples();
      const analysis = await analyze({
        embedder: this.embedder, useHistory: this.state.useHistory, sourceFolderIds: this.state.settings.sourceFolderIds,
        examples, lang: uiLanguage(),
        onProgress: (phase, done, total) => this.set({ progress: { phase, done, total } }),
      });
      // Corrections only count while the bookmark is still where the user put it (an undo cancels them).
      const kept = new Map([...examples].filter(([id, folderId]) => analysis.snapshot.bookmarks.get(id)?.parentId === folderId));
      if (kept.size !== examples.size) await store.saveExamples(kept);
      this.embedder.dispose();
      const decisions = defaultDecisions(analysis.proposal, this.state.settings.folderStyle, this.barDefaults(analysis));
      const empty = analysis.proposal.placements.length + analysis.proposal.review.length === 0;
      this.focusNext = 'apply';
      this.set({ analysis, decisions, view: empty ? 'empty' : 'review', wiresDrawn: false });
    } catch (e) {
      this.embedder.dispose();
      const msg = e instanceof Error ? e.message : String(e);
      this.set({ view: 'error', error: /model|onnx|fetch|wasm|404/i.test(msg) ? `${t('errorModel')} (${msg})` : msg });
    }
  }

  select(key: string | null): void {
    const previous = this.state.selected;
    this.focusNext = key ? 'sheet-close' : previous ? `node-${previous}` : null;
    this.set({ selected: key });
  }

  move(id: string, target: Target): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    d.moves[id] = { accepted: target.kind !== 'stay', target };
    if (target.kind === 'new') {
      const nf = d.newFolders[target.key];
      if (nf) nf.accepted = true;
    }
    const node = destinations(an, d).find((n) => n.ids.includes(id));
    const title = bookmarkTitle(an, d, id);
    announce(target.kind === 'stay' ? t('announceStay', title) : t('announceMoved', title, node ? (node.kind === 'stay' || node.kind === 'review' ? t('nodeStay') : node.name) : ''));
    this.render();
  }

  toggleTitle(id: string): void {
    const tt = this.state.decisions?.titles[id];
    if (tt) tt.accepted = !tt.accepted;
    this.render();
  }

  toggleIconOnly(id: string): void {
    const d = this.state.decisions;
    if (!d) return;
    d.iconOnly[id] = !d.iconOnly[id];
    this.render();
  }

  setNewFolder(key: string, patch: Partial<{ name: string; emoji: string; accepted: boolean }>): void {
    const nf = this.state.decisions?.newFolders[key];
    if (!nf) return;
    Object.assign(nf, patch);
    const p = this.state.analysis?.proposal.newFolders.find((f) => f.key === key);
    if (p && patch.name) p.name = patch.name;
    this.render();
  }

  setFolderEmoji(folderId: string, emoji: string): void {
    const d = this.state.decisions;
    if (!d) return;
    d.folderEmojis[folderId] = { accepted: !!emoji, emoji };
    this.render();
  }

  createFolder(name: string): string {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return 'stay';
    const key = `user-${++this.userFolders}`;
    const emoji = vocabForTitle(name)?.emoji ?? '📁';
    an.proposal.newFolders.push({ key, vocabId: null, name, emoji, parentId: an.snapshot.otherId ?? an.sourceFolderIds[0] ?? '', reason: { key: 'reasonUser' } });
    d.newFolders[key] = { accepted: true, name, emoji };
    return `n:${key}`;
  }

  rejectAll(): void {
    const d = this.state.decisions;
    if (!d) return;
    for (const m of Object.values(d.moves)) m.accepted = false;
    for (const x of Object.values(d.titles)) x.accepted = false;
    for (const x of Object.values(d.folderEmojis)) x.accepted = false;
    for (const k of Object.keys(d.iconOnly)) d.iconOnly[k] = false;
    this.focusNext = 'restore';
    this.render();
  }

  restoreProposal(): void {
    const an = this.state.analysis;
    if (!an) return;
    this.focusNext = 'apply';
    this.set({ decisions: defaultDecisions(an.proposal, this.state.settings.folderStyle, this.barDefaults(an)) });
  }

  apply(): void {
    void this.runApply();
  }

  private async runApply(): Promise<void> {
    const an = this.state.analysis;
    const d = this.state.decisions;
    // A proposal made on bookmarks that changed since is stale: it must be refreshed first.
    if (!an || !d || this.state.changedDuringReview) return;
    const ops = planFor(an, d);
    this.set({ view: 'progress', selected: null, progress: { phase: 'applying', done: 0, total: ops.length } });
    try {
      const res = await applyPlan(api, ops, store.journalStore, (done, total) => this.set({ progress: { phase: 'applying', done, total } }));
      const names = await store.loadIconOnlyNames();
      const examples = await store.loadExamples();
      const created = new Map(res.journal.entries.filter((e) => e.op.type === 'createFolder' && e.createdId).map((e) => [(e.op as { key: string }).key, e.createdId as string]));
      const proposed = new Map(an.proposal.placements.map((p) => [p.bookmarkId, JSON.stringify(p.target)]));
      for (const e of res.journal.entries) {
        if (e.status !== 'done') continue;
        if (e.op.type === 'rename' && e.op.iconOnly && e.before) names[e.op.id] = e.before.title;
        if (e.op.type === 'move' && proposed.get(e.op.id) !== JSON.stringify(d.moves[e.op.id]?.target)) {
          const folderId = e.op.to.folderId ?? created.get(e.op.to.newKey ?? '');
          if (folderId) examples.set(e.op.id, folderId);
        }
      }
      await Promise.all([store.saveIconOnlyNames(names), store.saveExamples(examples)]);
      this.focusNext = 'again';
      this.set({ view: 'done', result: { done: res.done, skipped: res.skipped.length }, lastJournal: res.journal, iconOnlyCount: Object.keys(names).length });
    } catch (e) {
      const unresolved = e instanceof UnresolvedJournalError;
      this.set({ view: 'error', error: unresolved ? t('errorUnresolved') : e instanceof Error ? e.message : String(e), lastJournal: await store.journalStore.load() });
    }
  }

  keepInterrupted(): void {
    void (async () => {
      await keepInterrupted(api, store.journalStore);
      this.set({ lastJournal: await store.journalStore.load() });
    })();
  }

  undo(): void {
    void (async () => {
      this.set({ tab: 'organize', view: 'progress', progress: { phase: 'applying', done: 0, total: 0 } });
      const res = await undoLast(api, store.journalStore);
      const names = await store.loadIconOnlyNames();
      for (const id of Object.keys(names)) {
        const node = (await api.get(id).catch(() => []))[0];
        if (!node || node.title !== '') delete names[id];
      }
      await store.saveIconOnlyNames(names);
      this.focusNext = 'again';
      this.set({ view: 'done', result: { done: res.done, skipped: res.skipped.length, undone: true }, lastJournal: await store.journalStore.load(), iconOnlyCount: Object.keys(names).length });
    })();
  }

  backToStart(): void {
    void store.journalStore.load().then(async (lastJournal) => {
      this.focusNext = 'analyze';
      this.set({ view: 'start', analysis: null, decisions: null, result: null, selected: null, lastJournal });
      await this.loadPreview();
    });
  }

  restoreNames(): void {
    void (async () => {
      const names = await store.loadIconOnlyNames();
      let n = 0;
      for (const [id, title] of Object.entries(names)) {
        const node = (await api.get(id).catch(() => []))[0];
        if (node && node.title === '') {
          await api.update(id, { title });
          n++;
        }
        delete names[id];
      }
      await store.saveIconOnlyNames(names);
      this.set({ iconOnlyCount: 0, status: t('namesRestored', n) });
    })();
  }

  clearCache(): void {
    void clearVectors().then(() => this.set({ status: t('cacheCleared') }));
  }
}

export function mount(root: HTMLElement): void {
  void new App(root).init();
}
