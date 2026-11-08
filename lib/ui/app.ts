import { browser } from 'wxt/browser';
import { analyze } from '../analyze';
import { type Destination, scopeCandidates } from '../categorize';
import { Embedder } from '../embedder';
import { t, uiLanguage } from '../i18n';
import { clearVectors } from '../idb';
import { type BackupSource, type BookmarksApi, UnresolvedJournalError, applyPlan, defaultDecisions, keepInterrupted, undoLast } from '../plan';
import { defaultScope } from '../pipeline';
import { isBackupTitle } from '../taxonomy';
import { buildSnapshot, type TreeNode } from '../snapshot';
import * as store from '../storage';
import type { Target } from '../types';
import { isWebUrl } from '../url';
import { vocabForTitle } from '../vocab';
import { announce, h, icon, replaceKeepingFocus } from './dom';
import { drawWires, planFor, reviewToolbar, reviewView } from './review';
import { bookmarkTitle } from './sheet';
import { type SettingsData, settingsView } from './settings';
import type { Actions, Preview, State } from './state';
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
      tab: 'organize', view: 'start', settings: store.DEFAULT_SETTINGS, useHistory: false, sitesAllowed: false, backups: [], expandedScope: [], moreOptions: false, preview: null, progress: { phase: 'reading', done: 0, total: 0 },
      analysis: null, decisions: null, selected: null, wiresDrawn: false, changedDuringReview: false, result: null, error: null, lastJournal: null, iconOnlyCount: 0, status: '',
    };
  }

  async init(): Promise<void> {
    document.title = t('extShortName');
    document.documentElement.lang = uiLanguage().split('-')[0] ?? 'en';
    const [settings, useHistory, sitesAllowed, lastJournal, names, backups] = await Promise.all([
      store.loadSettings(), store.hasHistoryPermission(), store.hasSitesPermission(), store.journalStore.load(), store.loadIconOnlyNames(), this.liveBackups(),
    ]);
    Object.assign(this.state, { settings, useHistory, sitesAllowed, lastJournal, backups, iconOnlyCount: Object.keys(names).length });
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

  /** Scope of the next sort: chosen folders, or the whole tree. */
  private scopeOf(snap: ReturnType<typeof buildSnapshot>): { include: string[]; exclude: string[] } {
    const include = this.state.settings.scopeFolderIds.filter((id) => snap.folders.has(id));
    return { include: include.length ? include : defaultScope(snap), exclude: this.state.settings.scopeExcluded.filter((id) => snap.folders.has(id)) };
  }

  private async loadPreview(): Promise<void> {
    const snap = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
    const web = new Set([...snap.bookmarks.values()].filter((b) => isWebUrl(b.url)).map((b) => b.id));
    const { include, exclude } = this.scopeOf(snap);
    const chosen = scopeCandidates(snap, web, include, exclude);
    // Bookmarks under each folder, whatever is chosen, for the picker.
    const everything = new Set(scopeCandidates(snap, web, defaultScope(snap)));
    const under = new Map<string, number>();
    for (const id of everything) {
      let f = snap.folders.get(snap.bookmarks.get(id)?.parentId ?? '');
      while (f) {
        under.set(f.id, (under.get(f.id) ?? 0) + 1);
        f = f.parentId ? snap.folders.get(f.parentId) : undefined;
      }
    }
    const isIncluded = (folderId: string): boolean => {
      let f = snap.folders.get(folderId);
      while (f) {
        if (exclude.includes(f.id)) return false;
        if (include.includes(f.id)) return true;
        f = f.parentId ? snap.folders.get(f.parentId) : undefined;
      }
      return false;
    };
    const rootName = (id: string, title: string) => (id === snap.barId ? t('barFolder') : id === snap.otherId ? t('otherFolder') : title);
    const folders: Preview['folders'] = [];
    for (const rootId of defaultScope(snap)) {
      const root = snap.folders.get(rootId);
      if (!root) continue;
      folders.push({ id: root.id, title: rootName(root.id, root.title), count: under.get(root.id) ?? 0, depth: 0, isRoot: true, included: isIncluded(root.id) });
      for (const childId of root.folderIds) {
        const child = snap.folders.get(childId);
        if (!child || child.unmodifiable || isBackupTitle(child.title)) continue;
        folders.push({ id: child.id, title: child.title || t('unnamed'), count: under.get(child.id) ?? 0, depth: 1, isRoot: false, included: isIncluded(child.id) });
      }
    }
    const urls = chosen.slice(0, 5).map((id) => snap.bookmarks.get(id)?.url ?? '');
    this.set({ preview: { count: chosen.length, folders, urls } });
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

  toggleScope(folderId: string, included: boolean): void {
    void (async () => {
      const snap = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
      const { include, exclude } = this.scopeOf(snap);
      const inc = new Set(include);
      const exc = new Set(exclude);
      // The folder's own choice replaces the choices made below it.
      const below = (id: string): boolean => {
        let f = snap.folders.get(id);
        while (f?.parentId) {
          if (f.parentId === folderId) return true;
          f = snap.folders.get(f.parentId);
        }
        return false;
      };
      for (const id of [...inc]) if (below(id)) inc.delete(id);
      for (const id of [...exc]) if (below(id)) exc.delete(id);
      inc.delete(folderId);
      exc.delete(folderId);
      const parentIncluded = (() => {
        let f = snap.folders.get(snap.folders.get(folderId)?.parentId ?? '');
        while (f) {
          if (exc.has(f.id)) return false;
          if (inc.has(f.id)) return true;
          f = f.parentId ? snap.folders.get(f.parentId) : undefined;
        }
        return false;
      })();
      if (included && !parentIncluded) inc.add(folderId);
      if (!included && parentIncluded) exc.add(folderId);
      const settings = { ...this.state.settings, scopeFolderIds: [...inc], scopeExcluded: [...exc] };
      // Nothing chosen any more is not "everything": keep an explicit empty choice out of the defaults.
      if (!inc.size) settings.scopeFolderIds = defaultScope(snap).filter((id) => !exc.has(id) && id !== folderId);
      await store.saveSettings(settings);
      this.state.settings = settings;
      await this.loadPreview();
    })();
  }

  toggleExpanded(folderId: string): void {
    const open = this.state.expandedScope.includes(folderId);
    this.set({ expandedScope: open ? this.state.expandedScope.filter((x) => x !== folderId) : [...this.state.expandedScope, folderId] });
  }

  toggleMoreOptions(): void {
    this.set({ moreOptions: !this.state.moreOptions });
  }

  setDestination(destination: Destination): void {
    const settings = { ...this.state.settings, destination };
    void store.saveSettings(settings);
    this.set({ settings });
  }

  setOption(key: 'readSites' | 'checkDead' | 'backup' | 'removeDuplicates', on: boolean): void {
    const settings = { ...this.state.settings, [key]: on };
    void store.saveSettings(settings);
    this.set({ settings, status: this.state.tab === 'settings' ? t('saved') : '' });
  }

  analyze(): void {
    const { readSites, checkDead } = this.state.settings;
    if ((readSites || checkDead) && !this.state.sitesAllowed) {
      // permissions.request must run synchronously inside the click handler.
      void store
        .requestSitesPermission()
        .catch(() => false)
        .then((granted) => {
          this.state.sitesAllowed = granted;
          void this.runAnalysis();
        });
      return;
    }
    void this.runAnalysis();
  }

  private barDefaults(an: NonNullable<State['analysis']>): string[] {
    if (!this.state.settings.iconOnlyBar || !an.snapshot.barId) return [];
    return (an.snapshot.folders.get(an.snapshot.barId)?.bookmarkIds ?? []).filter((id) => an.snapshot.bookmarks.get(id)?.title);
  }

  private async runAnalysis(): Promise<void> {
    this.set({ tab: 'organize', view: 'progress', progress: { phase: 'reading', done: 0, total: 0 }, changedDuringReview: false, error: null, selected: null });
    try {
      const [examples, known] = await Promise.all([store.loadExamples(), store.loadKnownFolders()]);
      const s = this.state.settings;
      const analysis = await analyze({
        embedder: this.embedder, useHistory: this.state.useHistory, scopeFolderIds: s.scopeFolderIds, scopeExcluded: s.scopeExcluded,
        examples, known, destination: s.destination, readSites: s.readSites && this.state.sitesAllowed, checkDead: s.checkDead && this.state.sitesAllowed,
        removeDuplicates: s.removeDuplicates,
        lang: uiLanguage(),
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
    // Choosing a place for a duplicate keeps it.
    d.removes[id] = false;
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
    const parentId = (an.destination === 'bar' ? an.snapshot.barId : an.snapshot.otherId) ?? an.snapshot.otherId ?? '';
    an.proposal.newFolders.push({ key, vocabId: null, name, emoji, parentId, reason: { key: 'reasonUser' } });
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
    for (const k of Object.keys(d.removes)) d.removes[k] = false;
    this.focusNext = 'restore';
    this.render();
  }

  keepAllDuplicates(): void {
    const d = this.state.decisions;
    if (!d) return;
    for (const k of Object.keys(d.removes)) d.removes[k] = false;
    announce(t('announceDupesKept'));
    this.select(null);
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
    const ops = planFor(an, d, this.state.settings.backup ? this.backupPlan(an) : undefined);
    this.set({ view: 'progress', selected: null, progress: { phase: 'applying', done: 0, total: ops.length } });
    try {
      const res = await applyPlan(api, ops, store.journalStore, (done, total) => this.set({ progress: { phase: 'applying', done, total } }));
      await this.remember(an, res.journal);
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
      this.set({ view: 'done', result: { done: res.journal.entries.filter((e) => e.status === 'done' && e.op.type !== 'backup').length, skipped: res.skipped.length }, lastJournal: res.journal, iconOnlyCount: Object.keys(names).length });
    } catch (e) {
      const unresolved = e instanceof UnresolvedJournalError;
      this.set({ view: 'error', error: unresolved ? t('errorUnresolved') : e instanceof Error ? e.message : String(e), lastJournal: await store.journalStore.load() });
    }
  }

  /** The backup copies the folders sorted, as they are, into a dated folder of "Other bookmarks". */
  private backupPlan(an: NonNullable<State['analysis']>): { parentId: string; title: string; sources: BackupSource[] } | undefined {
    const snap = an.snapshot;
    const parentId = snap.otherId ?? snap.barId;
    if (!parentId) return undefined;
    const ids = an.scopeFolderIds.filter((id) => snap.folders.has(id));
    const inside = (id: string, other: string) => {
      let f = snap.folders.get(snap.folders.get(id)?.parentId ?? '');
      while (f) {
        if (f.id === other) return true;
        f = f.parentId ? snap.folders.get(f.parentId) : undefined;
      }
      return false;
    };
    const sources = ids.filter((id) => !ids.some((o) => o !== id && inside(id, o))).map((id) => ({
      id,
      title: id === snap.barId ? t('barFolder') : id === snap.otherId ? t('otherFolder') : (snap.folders.get(id)?.title ?? ''),
    }));
    const date = new Date().toLocaleString(uiLanguage(), { dateStyle: 'short', timeStyle: 'short' });
    return { parentId, title: t('backupTitle', date), sources };
  }

  /** Folders created by this sort are recognised by the next one; the backup is listed in the settings. */
  private async remember(an: NonNullable<State['analysis']>, journal: import('../plan').Journal): Promise<void> {
    const known = await store.loadKnownFolders();
    const byKey = new Map(an.proposal.newFolders.map((f) => [f.key, f]));
    const backups = await store.loadBackups();
    for (const e of journal.entries) {
      if (e.status !== 'done' || !e.createdId) continue;
      if (e.op.type === 'createFolder') {
        const f = byKey.get(e.op.key);
        if (f?.vocabId) known.set(e.createdId, { category: f.vocabId });
        else if (f?.groupId) known.set(e.createdId, { group: f.groupId });
      } else if (e.op.type === 'backup') backups.push({ id: e.createdId, title: e.op.title, createdAt: journal.createdAt, count: e.after?.count });
    }
    await Promise.all([store.saveKnownFolders(known), store.saveBackups(backups)]);
    this.state.backups = await this.liveBackups();
  }

  /** Backups that still exist; the others were removed by the user or by an undo. */
  private async liveBackups(): Promise<store.BackupRecord[]> {
    const list = await store.loadBackups();
    const alive: store.BackupRecord[] = [];
    for (const b of list) if ((await api.get(b.id).catch(() => []))[0]) alive.push(b);
    if (alive.length !== list.length) await store.saveBackups(alive);
    return alive;
  }

  deleteBackup(id: string): void {
    void (async () => {
      await api.removeTree(id).catch(() => undefined);
      const backups = await this.liveBackups();
      this.set({ backups, status: t('backupDeleted') });
    })();
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
      this.set({ view: 'done', result: { done: res.done, skipped: res.skipped.length, undone: true }, lastJournal: await store.journalStore.load(), iconOnlyCount: Object.keys(names).length, backups: await this.liveBackups() });
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
