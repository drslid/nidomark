import { browser } from 'wxt/browser';
import { analyze } from '../analyze';
import { type Destination, REVIEW_KEY, scopeCandidates } from '../categorize';
import { normalizeUrl } from '../duplicates';
import { Embedder } from '../embedder';
import { t, uiLanguage } from '../i18n';
import { clearVectors } from '../idb';
import { type BookmarksApi, type Journal, UnresolvedJournalError, applyPlan, defaultDecisions, keepInterrupted, undoLast } from '../plan';
import { defaultScope, pruneScope } from '../pipeline';
import { isBackupTitle, knownSite } from '../taxonomy';
import { buildSnapshot, type TreeNode } from '../snapshot';
import * as store from '../storage';
import type { Target } from '../types';
import { isWebUrl } from '../url';
import { vocabForTitle } from '../vocab';
import { announce, h, icon, replaceKeepingFocus } from './dom';
import { drawWires, planFor, reviewToolbar, reviewView } from './review';
import { bookmarkTitle, folderPath, openConfirmDialog } from './sheet';
import { type SettingsData, settingsView } from './settings';
import type { Actions, Preview, State } from './state';
import { doneView, messageView, progressView, startView } from './views';

const api = browser.bookmarks as unknown as BookmarksApi;

export class App implements Actions {
  private state: State;
  private embedder = new Embedder();
  private settingsData: SettingsData = { folders: [] };
  private userFolders = 0;
  /** Names of the bookmarks shown as icons only, by bookmark. */
  private iconNames: Record<string, string> = {};
  /** Focus to restore after the next render (data-focus key). */
  private focusNext: string | null = null;

  constructor(private root: HTMLElement) {
    this.state = {
      tab: 'organize', view: 'start', settings: store.DEFAULT_SETTINGS, historyAllowed: false, sitesAllowed: false, backups: [], expandedScope: [], moreOptions: false, preview: null, progress: { phase: 'reading', done: 0, total: 0 },
      analysis: null, decisions: null, selected: null, wiresDrawn: false, changedDuringReview: false, result: null, error: null, lastJournal: null, iconOnlyCount: 0, status: '',
    };
  }

  async init(): Promise<void> {
    document.title = t('extShortName');
    document.documentElement.lang = uiLanguage().split('-')[0] ?? 'en';
    const [settings, historyAllowed, sitesAllowed, lastJournal, names, backups] = await Promise.all([
      store.loadSettings(), store.hasHistoryPermission(), store.hasSitesPermission(), store.journalStore.load(), store.loadIconOnlyNames(), this.liveBackups(),
    ]);
    Object.assign(this.state, { settings, historyAllowed, sitesAllowed, lastJournal, backups, iconOnlyCount: Object.keys(names).length });
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
    const back = s.tab === 'settings' ? () => this.setTab('organize') : review ? () => this.leaveReview() : null;
    const header = h('header', { class: 'appbar' },
      back ? h('button', { class: 'icon-btn', 'aria-label': t('back'), title: t('back'), 'data-focus': 'back', onclick: back }, icon('arrow_back')) : null,
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

  /** Scope of the next sort: chosen root folders and folders right inside them, or the whole tree. */
  private scopeOf(snap: ReturnType<typeof buildSnapshot>): { include: string[]; exclude: string[] } {
    const include = pruneScope(snap, this.state.settings.scopeFolderIds);
    return { include: include.length ? include : defaultScope(snap), exclude: pruneScope(snap, this.state.settings.scopeExcluded) };
  }

  private async loadPreview(): Promise<void> {
    const snap = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
    const { include, exclude } = this.scopeOf(snap);
    const chosen = scopeCandidates(snap, include, exclude);
    // Bookmarks under each folder, whatever is chosen, for the picker.
    const everything = new Set(scopeCandidates(snap, defaultScope(snap)));
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
    void op
      .catch(() => false)
      .then((granted) => {
        const settings = { ...this.state.settings, useHistory: on && !!granted };
        void store.saveSettings(settings);
        this.set({ settings, historyAllowed: !!granted, status: this.state.tab === 'settings' ? t('saved') : '' });
      });
  }

  setQuickAccess(n: number): void {
    const settings = { ...this.state.settings, quickAccess: n };
    void store.saveSettings(settings);
    this.set({ settings, status: this.state.tab === 'settings' ? t('saved') : '' });
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

  setOption(key: 'readSites' | 'checkDead' | 'removeDuplicates', on: boolean): void {
    const settings = { ...this.state.settings, [key]: on };
    void store.saveSettings(settings);
    this.set({ settings, status: this.state.tab === 'settings' ? t('saved') : '' });
  }

  analyze(): void {
    const s = this.state.settings;
    const sites = (s.readSites || s.checkDead) && !this.state.sitesAllowed;
    const history = s.useHistory && !this.state.historyAllowed;
    if (sites || history) {
      // One browser prompt for everything missing; permissions.request must run synchronously inside the click handler.
      void store
        .requestPermissions({ history, sites })
        .catch(() => false)
        .then(async () => {
          const [sitesAllowed, historyAllowed] = await Promise.all([store.hasSitesPermission(), store.hasHistoryPermission()]);
          Object.assign(this.state, { sitesAllowed, historyAllowed });
          void this.runAnalysis();
        });
      return;
    }
    void this.runAnalysis();
  }

  /** Quick access shows icons only by default; links that are not web pages keep their name (they have no icon). */
  private barDefaults(an: NonNullable<State['analysis']>): string[] {
    if (!this.state.settings.iconOnlyBar) return [];
    return an.proposal.quickAccess.filter((id) => isWebUrl(an.snapshot.bookmarks.get(id)?.url ?? ''));
  }

  private async runAnalysis(): Promise<void> {
    this.set({ tab: 'organize', view: 'progress', progress: { phase: 'reading', done: 0, total: 0 }, changedDuringReview: false, error: null, selected: null });
    try {
      const [learned, known] = await Promise.all([store.loadLearned(), store.loadKnownFolders()]);
      const s = this.state.settings;
      const choices = (r: Record<string, store.LearnedChoice>) => new Map(Object.entries(r).map(([k, c]) => [k, c.category]));
      const analysis = await analyze({
        embedder: this.embedder, useHistory: s.useHistory && this.state.historyAllowed, scopeFolderIds: s.scopeFolderIds, scopeExcluded: s.scopeExcluded,
        learned: { urls: choices(learned.urls), domains: choices(learned.domains) }, quickAccess: s.quickAccess,
        known, destination: s.destination, readSites: s.readSites && this.state.sitesAllowed, checkDead: s.checkDead && this.state.sitesAllowed,
        removeDuplicates: s.removeDuplicates,
        lang: uiLanguage(),
        onProgress: (phase, done, total) => this.set({ progress: { phase, done, total } }),
      });
      this.embedder.dispose();
      this.iconNames = await store.loadIconOnlyNames();
      const decisions = this.decisionsFor(analysis);
      const empty = analysis.proposal.candidates.length === 0;
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
    d.moves[id] = { accepted: true, target };
    if (target.kind === 'new') this.acceptWithParents(target.key);
    const place = target.kind === 'bar' ? t('nodeBar') : target.kind === 'new' ? (target.key === REVIEW_KEY ? t('nodeReview') : folderPath(an, d, target.key)) : '';
    announce(t('announceMoved', bookmarkTitle(an, d, id), place));
    this.render();
  }

  /** A folder is only created with the folders above it. */
  private acceptWithParents(key: string): void {
    const byKey = new Map(this.state.analysis?.proposal.newFolders.map((f) => [f.key, f]));
    for (let k: string | undefined = key, i = 0; k && i < 8; k = byKey.get(k)?.parentKey, i++) {
      const nf = this.state.decisions?.newFolders[k];
      if (nf) nf.accepted = true;
    }
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
    if (patch.accepted) this.acceptWithParents(key);
    const p = this.state.analysis?.proposal.newFolders.find((f) => f.key === key);
    if (p && patch.name) p.name = patch.name;
    this.render();
  }

  createFolder(name: string): string {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return 'stay';
    const key = `user-${++this.userFolders}`;
    const emoji = vocabForTitle(name)?.emoji ?? '📁';
    const parentId = (an.destination === 'bar' ? an.snapshot.barId : an.snapshot.otherId) ?? an.snapshot.otherId ?? '';
    an.proposal.newFolders.push({ key, vocabId: null, name, emoji, parentId, level: 1, reason: { key: 'reasonUser' } });
    d.newFolders[key] = { accepted: true, name, emoji };
    return `n:${key}`;
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
    this.set({ decisions: this.decisionsFor(an) });
  }

  /** The proposal accepted as it is; a bookmark shown as an icon gets back its name, kept since it was hidden. */
  private decisionsFor(an: NonNullable<State['analysis']>): NonNullable<State['decisions']> {
    const d = defaultDecisions(an.proposal, this.state.settings.folderStyle, this.barDefaults(an));
    for (const id of an.proposal.candidates) {
      const name = this.iconNames[id];
      if (name && an.snapshot.bookmarks.get(id)?.title === '') d.titles[id] = { accepted: true, title: name };
    }
    return d;
  }

  apply(): void {
    void this.runApply();
  }

  private async runApply(): Promise<void> {
    const an = this.state.analysis;
    const d = this.state.decisions;
    // A proposal made on bookmarks that changed since is stale: it must be refreshed first.
    if (!an || !d || this.state.changedDuringReview) return;
    const archiveTitle = t('backupTitle', new Date().toLocaleString(uiLanguage(), { dateStyle: 'short', timeStyle: 'short' }));
    const ops = planFor(an, d, archiveTitle);
    this.set({ view: 'progress', selected: null, progress: { phase: 'applying', done: 0, total: ops.length } });
    try {
      const res = await applyPlan(api, ops, store.journalStore, (done, total) => this.set({ progress: { phase: 'applying', done, total } }));
      await this.remember(an, d, res.journal);
      const names = await store.loadIconOnlyNames();
      const done = res.journal.entries.filter((e) => e.status === 'done');
      // Quick access shown as icons: their names are kept, to show them again later.
      for (const e of done) {
        const name = e.op.type === 'createBookmark' && e.op.title === '' ? bookmarkTitle(an, d, e.op.source) : '';
        if (name && e.createdId) names[e.createdId] = name;
      }
      await store.saveIconOnlyNames(names);
      const archived = done.some((e) => e.op.type === 'createFolder' && e.op.key === 'archive');
      this.focusNext = 'again';
      this.set({
        view: 'done',
        result: {
          done: done.filter((e) => e.op.type === 'createBookmark').length,
          folders: done.filter((e) => e.op.type === 'createFolder' && !e.op.key.startsWith('archive')).length,
          skipped: res.skipped.length,
          archive: archived ? archiveTitle : undefined,
        },
        lastJournal: res.journal,
        iconOnlyCount: Object.keys(names).length,
      });
    } catch (e) {
      const unresolved = e instanceof UnresolvedJournalError;
      this.set({ view: 'error', error: unresolved ? t('errorUnresolved') : e instanceof Error ? e.message : String(e), lastJournal: await store.journalStore.load() });
    }
  }

  /**
   * After a sort: the folders it created are recognised by the next one, the archive is listed in the settings, and
   * the bookmarks the user filed elsewhere than proposed teach the next sorts (until this one is undone).
   */
  private async remember(an: NonNullable<State['analysis']>, d: NonNullable<State['decisions']>, journal: Journal): Promise<void> {
    const [known, backups, learned] = await Promise.all([store.loadKnownFolders(), store.loadBackups(), store.loadLearned()]);
    const byKey = new Map(an.proposal.newFolders.map((f) => [f.key, f]));
    const snap = an.snapshot;
    const bookmarksUnder = (folderId: string): number => {
      const f = snap.folders.get(folderId);
      return f ? f.bookmarkIds.length + f.folderIds.reduce((n, c) => n + bookmarksUnder(c), 0) : 0;
    };
    let archived = 0;
    for (const e of journal.entries) {
      if (e.status !== 'done') continue;
      if (e.op.type === 'move' && e.op.to.newKey?.startsWith('archive:')) archived += snap.bookmarks.has(e.op.id) ? 1 : bookmarksUnder(e.op.id);
    }
    for (const e of journal.entries) {
      if (e.status !== 'done' || !e.createdId || e.op.type !== 'createFolder') continue;
      if (e.op.key === 'archive') {
        backups.push({ id: e.createdId, title: e.op.title, createdAt: journal.createdAt, count: archived });
        continue;
      }
      // Only the folders of a group or a category: a subfolder by site ("Netflix") or a folder of the user
      // recreated under a category keeps its own meaning at the next sort.
      const f = byKey.get(e.op.key);
      const name = d.newFolders[e.op.key]?.name ?? f?.name;
      if (e.op.key.startsWith('c:') && f?.vocabId) known.set(e.createdId, { category: f.vocabId, name });
      else if (e.op.key.startsWith('g:') && f?.groupId) known.set(e.createdId, { group: f.groupId, name });
    }
    const placed = new Map(an.proposal.placements.map((p) => [p.bookmarkId, p.target]));
    for (const [id, m] of Object.entries(d.moves)) {
      const proposed = placed.get(id);
      if (m.target.kind !== 'new' || (proposed?.kind === 'new' && proposed.key === m.target.key)) continue;
      const category = byKey.get(m.target.key)?.vocabId;
      const b = snap.bookmarks.get(id);
      if (!category || !b) continue;
      const choice = { category, run: journal.id };
      learned.urls[normalizeUrl(b.url) ?? b.url] = choice;
      // The whole site follows, unless it publishes on every subject or only exists at home.
      const f = an.features.get(id);
      if (f?.registrable && !f.privateHost && !knownSite(b.url)?.platform) learned.domains[f.registrable] = choice;
    }
    await Promise.all([store.saveKnownFolders(known), store.saveBackups(backups), store.saveLearned(learned)]);
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
      const run = (await store.journalStore.load())?.id;
      const res = await undoLast(api, store.journalStore, (done, total) => this.set({ progress: { phase: 'applying', done, total } }));
      // What this sort taught is forgotten with it.
      if (run) await store.forgetRun(run);
      const names = await store.loadIconOnlyNames();
      for (const id of Object.keys(names)) {
        const node = (await api.get(id).catch(() => []))[0];
        if (!node || node.title !== '') delete names[id];
      }
      await store.saveIconOnlyNames(names);
      this.focusNext = 'again';
      this.set({ view: 'done', result: { done: res.done, folders: 0, skipped: res.skipped.length, undone: true }, lastJournal: await store.journalStore.load(), iconOnlyCount: Object.keys(names).length, backups: await this.liveBackups() });
    })();
  }

  /** Leaving the review discards the proposal: nothing was changed yet, but the analysis would have to run again. */
  private leaveReview(): void {
    openConfirmDialog(t('leaveTitle'), t('leaveBody'), t('leaveConfirm'), () => this.backToStart());
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
