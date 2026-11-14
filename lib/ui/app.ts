import { browser } from 'wxt/browser';
import { analyze, reanalyze } from '../analyze';
import { type Destination, scopeCandidates } from '../categorize';
import { normalizeUrl } from '../duplicates';
import { bookmarksUnder, fileAsSuggested, foldersUnder, isWithin, meaningOf, mergeAnalysis, sessionLearned, suggestionTarget, userFolder, userMoves } from '../edit';
import { Embedder } from '../embedder';
import { rootFolderName, t, uiDirection, uiLanguage } from '../i18n';
import { clearVectors } from '../idb';
import { type BookmarksApi, type Decisions, type FolderParent, type FolderStyle, type Journal, UnresolvedJournalError, applyPlan, defaultDecisions, keepInterrupted, undoLast } from '../plan';
import { defaultScope, pruneScope } from '../pipeline';
import { isBackupTitle, knownSite, localName } from '../taxonomy';
import { buildSnapshot, type TreeNode } from '../snapshot';
import * as store from '../storage';
import type { Proposal, Target } from '../types';
import { isWebUrl } from '../url';
import { openConfirmDialog } from './dialogs';
import { announce, h, icon, replaceKeepingFocus } from './dom';
import { drawWires, planFor, reviewToolbar, reviewView } from './review';
import { bookmarkTitle, nodeTitle, rootTitle } from './shared';
import { type SettingsData, settingsView } from './settings';
import type { Actions, Preview, State } from './state';
import { type Layout, layout, nodeKeyOf, treeOf } from './viewmodel';
import { doneView, messageView, progressView, startView } from './views';

const api = browser.bookmarks as unknown as BookmarksApi;

/** Categories of the stored choices, by address or site. */
const choices = (r: Record<string, store.LearnedChoice>) => new Map(Object.entries(r).map(([k, c]) => [k, c.category]));

/** Edits of the review that can be undone, latest last. */
const HISTORY_MAX = 50;

export class App implements Actions {
  private state: State;
  private embedder = new Embedder();
  private settingsData: SettingsData = { folders: [] };
  private userFolders = 0;
  /** Names of the bookmarks shown as icons only, by bookmark. */
  private iconNames: Record<string, string> = {};
  /** Focus to restore after the next render (data-focus key). */
  private focusNext: string | null = null;
  /** The proposal and the decisions before each edit of the review. */
  private history: { proposal: Proposal; decisions: Decisions }[] = [];
  private snackTimer = 0;
  /** The proposal as the analysis made it, before any folder was analysed again. */
  private original: Proposal | null = null;
  /** The new analysis of a folder under way: stopped when the review is left or analysed again from scratch. */
  private reanalysis: { controller: AbortController; embedder: Embedder } | null = null;

  constructor(private root: HTMLElement) {
    this.state = {
      tab: 'organize', view: 'start', settings: store.DEFAULT_SETTINGS, historyAllowed: false, sitesAllowed: false, backups: [], expandedScope: [], moreOptions: false, preview: null, progress: { phase: 'reading', done: 0, total: 0 },
      analysis: null, decisions: null, selected: null, collapsed: [], renaming: null, busy: null, snack: null, canUndo: false,
      wiresDrawn: false, changedDuringReview: false, result: null, error: null, lastJournal: null, iconOnlyCount: 0, status: '',
    };
  }

  async init(): Promise<void> {
    document.title = t('extShortName');
    // The full tag (zh-TW, pt-BR) picks the right glyphs and number formats; Arabic reads right to left.
    document.documentElement.lang = uiLanguage();
    document.documentElement.dir = uiDirection();
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
      const layer = document.querySelector('.menu:popover-open, dialog[open]');
      if (e.key === 'Escape' && this.state.selected && !layer) {
        this.select(null);
        return;
      }
      // Ctrl+Z (Cmd+Z) undoes the last edit of the review, outside text fields.
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z' && this.state.view === 'review' && !typing && !layer && this.history.length) {
        e.preventDefault();
        this.undoEdit();
      }
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
    const hadFocus = this.root.contains(document.activeElement);
    replaceKeepingFocus(this.root, h('div', null, header, h('main', null, main)));
    if (this.focusNext) {
      this.root.querySelector<HTMLElement>(`[data-focus="${CSS.escape(this.focusNext)}"]`)?.focus({ preventScroll: true });
      this.focusNext = null;
    }
    // A control that disappeared with an edit hands the focus to the sheet, or to the node that was open.
    if (review && hadFocus && !this.root.contains(document.activeElement)) {
      (this.root.querySelector<HTMLElement>('[data-focus="sheet-close"]') ?? this.root.querySelector<HTMLElement>('[data-focus="apply"]'))?.focus({ preventScroll: true });
    }
    if (review) {
      drawWires(this.root, !s.wiresDrawn);
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
    const rootName = (id: string, title: string) => rootFolderName(id === snap.barId ? 'bar' : id === snap.otherId ? 'other' : 'mobile', title);
    const folders: Preview['folders'] = [];
    for (const rootId of defaultScope(snap)) {
      const root = snap.folders.get(rootId);
      if (!root) continue;
      folders.push({ id: root.id, title: rootName(root.id, root.title), count: under.get(root.id) ?? 0, depth: 0, isRoot: true, isBar: root.id === snap.barId, included: isIncluded(root.id) });
      for (const childId of root.folderIds) {
        const child = snap.folders.get(childId);
        if (!child || child.unmodifiable || isBackupTitle(child.title)) continue;
        folders.push({ id: child.id, title: child.title || t('unnamed'), count: under.get(child.id) ?? 0, depth: 1, isRoot: false, isBar: false, included: isIncluded(child.id) });
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
      this.commit();
      d.folderStyle = style;
      // The style of the sort applies to every folder again.
      for (const nf of Object.values(d.newFolders)) delete nf.style;
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
    this.stopReanalysis();
    this.set({ tab: 'organize', view: 'progress', progress: { phase: 'reading', done: 0, total: 0 }, changedDuringReview: false, error: null, selected: null, busy: null });
    try {
      const [learned, known] = await Promise.all([store.loadLearned(), store.loadKnownFolders()]);
      const s = this.state.settings;
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
      this.history = [];
      this.original = analysis.proposal;
      this.set({ analysis, decisions, view: empty ? 'empty' : 'review', wiresDrawn: false, collapsed: [], renaming: null, snack: null, canUndo: false });
    } catch (e) {
      this.embedder.dispose();
      const msg = e instanceof Error ? e.message : String(e);
      this.set({ view: 'error', error: /model|onnx|fetch|wasm|404/i.test(msg) ? `${t('errorModel')} (${msg})` : msg });
    }
  }

  select(key: string | null): void {
    const previous = this.state.selected;
    this.focusNext = key ? 'sheet-close' : previous ? `node-${previous}` : null;
    this.set({ selected: key, renaming: null });
  }

  /** Keeps the state before an edit, to undo it. */
  private commit(): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    this.history.push({ proposal: an.proposal, decisions: structuredClone(d) });
    if (this.history.length > HISTORY_MAX) this.history.shift();
    this.state.canUndo = true;
  }

  /** Says what an edit did, with an undo for a few seconds. */
  private edited(text: string, undo = true): void {
    this.state.snack = { text, undo: undo && this.history.length > 0 };
    announce(text);
    window.clearTimeout(this.snackTimer);
    const hide = () => {
      // Never under a drag or an open menu: the page is drawn again when it goes.
      if (document.querySelector('.board.drag-active, .menu:popover-open, dialog[open]')) {
        this.snackTimer = window.setTimeout(hide, 2000);
        return;
      }
      this.state.snack = null;
      if (this.state.view === 'review') this.render();
    };
    this.snackTimer = window.setTimeout(hide, 8000);
    this.render();
  }

  undoEdit(): void {
    // A folder being analysed again is merged into the tree as it is now: nothing changes meanwhile.
    if (this.state.busy) return;
    const an = this.state.analysis;
    const last = this.history.pop();
    if (!an || !last) return;
    an.proposal = last.proposal;
    window.clearTimeout(this.snackTimer);
    const lay = layout(an, last.decisions);
    this.state.decisions = last.decisions;
    announce(t('editUndone'));
    this.set({ snack: null, renaming: null, canUndo: this.history.length > 0, selected: this.state.selected && lay.byKey.has(this.state.selected) ? this.state.selected : null });
  }

  dismissSnack(): void {
    window.clearTimeout(this.snackTimer);
    this.set({ snack: null });
  }

  /** Name of a place of the new tree, for messages: "Tech › Development", "Quick access". */
  private placeName(lay: Layout, target: Target): string {
    const an = this.state.analysis;
    if (!an) return '';
    if (target.kind === 'bar') return t('nodeBar');
    if (target.kind === 'existing') return rootTitle(an, target.folderId);
    if (target.kind !== 'new') return '';
    const key = lay.tree.resolve(target.key);
    const names: string[] = [];
    for (let k = key, i = 0; k && i < 64; k = lay.tree.byKey.get(k)?.parentKey, i++) names.unshift(lay.tree.byKey.get(k)?.name ?? '');
    return names.join(' › ') || rootTitle(an, lay.tree.rootOf(target.key));
  }

  move(id: string, target: Target): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    this.commit();
    // Choosing a place for a duplicate or a removed bookmark keeps it.
    d.removes[id] = false;
    d.moves[id] = { accepted: true, target };
    this.edited(t('announceMoved', bookmarkTitle(an, d, id) || t('unnamed'), this.placeName(layout(an, d), target)));
  }

  toggleTitle(id: string): void {
    const tt = this.state.decisions?.titles[id];
    if (!tt) return;
    this.commit();
    tt.accepted = !tt.accepted;
    this.render();
  }

  toggleIconOnly(id: string): void {
    const d = this.state.decisions;
    if (!d) return;
    this.commit();
    d.iconOnly[id] = !d.iconOnly[id];
    this.render();
  }

  renameBookmark(id: string, title: string): void {
    const d = this.state.decisions;
    if (!d) return;
    this.commit();
    d.titles[id] = { accepted: true, title };
    this.focusNext = `more-${id}`;
    this.state.renaming = null;
    this.edited(t('renamedTo', title));
  }

  startRename(id: string | null): void {
    const previous = this.state.renaming;
    this.focusNext = id ? `rename-${id}` : previous ? `more-${previous}` : null;
    this.set({ renaming: id });
  }

  removeBookmark(id: string): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    this.commit();
    d.removes[id] = true;
    this.edited(t('removedOne', bookmarkTitle(an, d, id) || t('unnamed')));
  }

  restoreBookmarks(ids: string[]): void {
    const d = this.state.decisions;
    if (!d || !ids.length) return;
    this.commit();
    for (const id of ids) d.removes[id] = false;
    this.edited(ids.length === 1 ? t('restoredOne') : t('restoredCount', ids.length.toLocaleString()));
  }

  setNewFolder(key: string, patch: Partial<{ name: string; emoji: string; style: FolderStyle }>): void {
    const d = this.state.decisions;
    const nf = d?.newFolders[key];
    if (!d || !nf) return;
    this.commit();
    Object.assign(nf, patch);
    // A folder of the user's own stands for what its new name means ("Recipes" files recipes).
    const own = d.userFolders.find((f) => f.key === key);
    if (own && patch.name) Object.assign(own, { name: patch.name, vocabId: meaningOf(patch.name).vocabId, groupId: meaningOf(patch.name).groupId });
    this.render();
  }

  createFolder(name: string, parent: FolderParent, moveId?: string): string {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return '';
    this.commit();
    const key = `user-${++this.userFolders}`;
    const f = userFolder(key, name, parent);
    d.userFolders.push(f);
    d.newFolders[key] = { accepted: true, name, emoji: f.emoji };
    if (moveId) {
      d.removes[moveId] = false;
      d.moves[moveId] = { accepted: true, target: { kind: 'new', key } };
    }
    if ('key' in parent) this.state.collapsed = this.state.collapsed.filter((k) => k !== nodeKeyOf(parent.key));
    this.edited(moveId ? t('announceMoved', bookmarkTitle(an, d, moveId) || t('unnamed'), name) : t('folderCreated', name));
    return key;
  }

  moveFolder(key: string, parent: FolderParent): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    const nf = d?.newFolders[key];
    if (!an || !d || !nf) return;
    const tree = treeOf(an, d);
    if (('key' in parent && isWithin(tree, parent.key, key)) || tree.byKey.get(key)?.existingId) return;
    this.commit();
    nf.parent = parent;
    if ('key' in parent) this.state.collapsed = this.state.collapsed.filter((k) => k !== nodeKeyOf(parent.key));
    const lay = layout(an, d);
    const place = 'key' in parent ? this.placeName(lay, { kind: 'new', key: parent.key }) : rootTitle(an, parent.rootId);
    this.edited(t('folderMoved', nf.name, place));
  }

  deleteFolder(key: string, withContent: boolean): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d || !d.newFolders[key]) return;
    const lay = layout(an, d);
    const nodeKey = nodeKeyOf(key);
    const name = nodeTitle(lay.byKey.get(nodeKey) ?? { kind: 'new', name: d.newFolders[key]?.name ?? '' } as never);
    this.commit();
    if (withContent) {
      for (const id of bookmarksUnder(lay.tree, key)) d.removes[id] = true;
      for (const k of [key, ...foldersUnder(lay.tree, key)]) {
        const nf = d.newFolders[k];
        if (nf) nf.accepted = false;
      }
    } else (d.newFolders[key] as { accepted: boolean }).accepted = false;
    // The sheet follows the content: to the folder above, or closes.
    let selected = this.state.selected;
    if (selected && (selected === nodeKey || (lay.byKey.get(selected)?.folder && isWithin(lay.tree, lay.byKey.get(selected)?.folder as string, key)))) {
      const up = lay.parent.get(nodeKey);
      selected = !withContent && up ? up : null;
    }
    this.state.selected = selected;
    this.focusNext = selected ? 'sheet-close' : 'add-folder';
    this.edited(withContent ? t('folderDeletedAll', name) : t('folderDeleted', name));
  }

  toggleCollapsed(nodeKey: string): void {
    const c = this.state.collapsed;
    this.set({ collapsed: c.includes(nodeKey) ? c.filter((k) => k !== nodeKey) : [...c, nodeKey] });
  }

  /** Files a bookmark in the folder of a suggested category, making the folder when the tree has none. */
  private applySuggestion(lay: Layout, d: Decisions, id: string, category: string): boolean {
    const an = this.state.analysis;
    if (!an) return false;
    const snap = an.snapshot;
    const lang = uiLanguage();
    const destinationRoot = (an.destination === 'bar' ? snap.barId : snap.otherId) ?? snap.otherId ?? snap.barId ?? '';
    const s = suggestionTarget(lay.tree, category, an.features.get(id)?.registrable ?? '', { lang, destinationRoot, otherRoot: snap.otherId ?? destinationRoot, localName: (x) => localName(x, lang) });
    if (!s) return false;
    fileAsSuggested(d, id, s);
    return true;
  }

  acceptSuggestion(id: string, category: string): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    this.commit();
    if (!this.applySuggestion(layout(an, d), d, id, category)) return;
    const target = d.moves[id]?.target as Target;
    this.edited(t('announceMoved', bookmarkTitle(an, d, id) || t('unnamed'), this.placeName(layout(an, d), target)));
  }

  acceptAllSuggestions(): void {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    const lay = layout(an, d);
    const ids = (lay.byKey.get('review')?.ids ?? []).filter((id) => an.proposal.suggestions[id]?.length);
    if (!ids.length) return;
    this.commit();
    let n = 0;
    for (const id of ids) if (this.applySuggestion(lay, d, id, an.proposal.suggestions[id]?.[0] as string)) n++;
    this.edited(t('acceptedAll', n.toLocaleString()));
  }

  reanalyze(nodeKey: string): void {
    if (!this.state.analysis || this.state.busy) return;
    // Reading the pages is what a new analysis adds: Chrome asks for the access once, inside the click.
    if (!this.state.sitesAllowed) {
      void store
        .requestPermissions({ history: false, sites: true })
        .catch(() => false)
        .then(async () => {
          this.state.sitesAllowed = await store.hasSitesPermission();
          void this.runReanalysis(nodeKey);
        });
      return;
    }
    void this.runReanalysis(nodeKey);
  }

  private async runReanalysis(nodeKey: string): Promise<void> {
    const an = this.state.analysis;
    const d = this.state.decisions;
    if (!an || !d) return;
    const lay = layout(an, d);
    const node = lay.byKey.get(nodeKey);
    if (!node?.folder) return;
    const name = nodeTitle(node);
    // The bookmarks the user placed are theirs: only the others are filed again.
    const moved = userMoves(an.proposal, d);
    const ids = bookmarksUnder(lay.tree, node.folder).filter((id) => !moved.has(id));
    if (!ids.length) {
      this.edited(t('reanalyzedNothing', name), false);
      return;
    }
    this.stopReanalysis();
    // Its own model worker: a new analysis from scratch may start meanwhile and stop this one.
    const run = { controller: new AbortController(), embedder: new Embedder() };
    this.reanalysis = run;
    const live = () => !run.controller.signal.aborted && this.state.analysis === an;
    this.set({ busy: { name, phase: 'reading', done: 0, total: 0 } });
    try {
      const stored = await store.loadLearned();
      const learned = sessionLearned(an.snapshot, an.features, an.proposal, d, lay.tree, { urls: choices(stored.urls), domains: choices(stored.domains) });
      const res = await reanalyze(an, {
        embedder: run.embedder, ids, learned, readSites: this.state.sitesAllowed, signal: run.controller.signal,
        onProgress: (phase, done, total) => {
          if (live()) this.set({ busy: { name, phase, done, total } });
        },
      });
      if (!live()) return;
      const now = this.state.decisions as Decisions;
      this.commit();
      const merged = mergeAnalysis(an.proposal, now, treeOf(an, now), res.result.proposal, ids);
      an.proposal = merged.proposal;
      an.input = res.input;
      for (const id of ids) {
        const x = res.result.assessments.get(id);
        if (x) an.assessments.set(id, x);
      }
      for (const f of merged.added) now.newFolders[f.key] ??= { accepted: true, name: f.name, emoji: f.emoji };
      for (const [id, target] of merged.moves) now.moves[id] = { accepted: true, target };
      this.state.busy = null;
      const n = merged.changed.length;
      this.edited(n ? t('reanalyzedMoved', n.toLocaleString(), name) : t('reanalyzedSame', name), n > 0);
    } catch (e) {
      if (!live()) return;
      this.state.busy = null;
      this.edited(t('reanalyzeFailed', e instanceof Error ? e.message : String(e)), false);
    } finally {
      run.embedder.close();
      if (this.reanalysis === run) this.reanalysis = null;
    }
  }

  /** Stops a new analysis of a folder under way: what it would have found is dropped. */
  private stopReanalysis(): void {
    const run = this.reanalysis;
    if (!run) return;
    this.reanalysis = null;
    run.controller.abort();
    run.embedder.close();
    this.state.busy = null;
  }

  restoreProposal(): void {
    const an = this.state.analysis;
    if (!an || this.state.busy) return;
    this.commit();
    // The proposal as first made: a folder analysed again since then is filed as the analysis had filed it.
    if (this.original) an.proposal = this.original;
    this.focusNext = 'apply';
    this.state.decisions = this.decisionsFor(an);
    this.edited(t('proposalRestored'));
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
    const tree = treeOf(an, d);
    const byKey = tree.known;
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
      // Only the folders of a group or a category, and the user's own named after one: a subfolder by site
      // ("Netflix") or a folder of the user recreated under a category keeps its own meaning at the next sort.
      const f = byKey.get(e.op.key);
      const name = d.newFolders[e.op.key]?.name ?? f?.name;
      // Folders the user made, by hand or from a suggestion ("s:<category>").
      const own = e.op.key.startsWith('user-') || e.op.key.startsWith('s:');
      if ((e.op.key.startsWith('c:') || own) && f?.vocabId) known.set(e.createdId, { category: f.vocabId, name });
      else if ((e.op.key.startsWith('g:') || own) && f?.groupId) known.set(e.createdId, { group: f.groupId, name });
      else if (e.op.key === 'review' || e.op.key === 'special' || e.op.key === 'mine') known.set(e.createdId, { role: e.op.key, name });
    }
    for (const id of userMoves(an.proposal, d)) {
      const place = tree.place.get(id);
      const category = place?.kind === 'folder' ? byKey.get(place.key)?.vocabId : undefined;
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
    this.stopReanalysis();
    void store.journalStore.load().then(async (lastJournal) => {
      this.focusNext = 'analyze';
      this.history = [];
      this.original = null;
      this.set({ view: 'start', analysis: null, decisions: null, result: null, selected: null, collapsed: [], renaming: null, busy: null, snack: null, canUndo: false, lastJournal });
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
