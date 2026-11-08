import { browser } from 'wxt/browser';
import type { Destination } from './categorize';
import type { FolderStyle, Journal, JournalStore } from './plan';
import type { GroupId } from './taxonomy';

export interface Settings {
  folderStyle: FolderStyle;
  iconOnlyBar: boolean;
  /** Folders to sort, with everything inside them; empty = the whole tree. */
  scopeFolderIds: string[];
  /** Folders left out, inside the chosen ones. */
  scopeExcluded: string[];
  /** Where new folders are created. */
  destination: Destination;
  /** Read the pages the title does not explain. */
  readSites: boolean;
  /** Look for sites that no longer answer. */
  checkDead: boolean;
  /** Leave the copies of a page out of the new tree (they stay in the archive). */
  removeDuplicates: boolean;
  /** Icons of the most visited sites at the start of the bookmarks bar (0: none). */
  quickAccess: number;
  /** Count the visits of each site in the history, on this computer, to put the most used first. */
  useHistory: boolean;
}

export const DEFAULT_SETTINGS: Settings = { folderStyle: 'emoji', iconOnlyBar: true, scopeFolderIds: [], scopeExcluded: [], destination: 'bar', readSites: true, checkDead: true, removeDuplicates: true, quickAccess: 10, useHistory: true };

const local = browser.storage.local;

export async function loadSettings(): Promise<Settings> {
  const { settings } = await local.get('settings');
  const saved = (settings as (Partial<Settings> & { sourceFolderIds?: string[]; backup?: boolean }) | undefined) ?? {};
  // Before 0.2 only the direct content of chosen folders was sorted; since 0.3 the archive is not optional.
  const { sourceFolderIds: _legacy, backup: _backup, ...rest } = saved;
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function saveSettings(s: Settings): Promise<void> {
  await local.set({ settings: s });
}

export const journalStore: JournalStore = {
  async load() {
    const { journal } = await local.get('journal');
    return (journal as Journal | undefined) ?? null;
  },
  async save(j: Journal) {
    await local.set({ journal: j });
  },
};

/** Original titles of bookmarks shown as icon only, to show their names again later. */
export async function loadIconOnlyNames(): Promise<Record<string, string>> {
  const { iconOnlyNames } = await local.get('iconOnlyNames');
  return (iconOnlyNames as Record<string, string> | undefined) ?? {};
}

export async function saveIconOnlyNames(names: Record<string, string>): Promise<void> {
  await local.set({ iconOnlyNames: names });
}

/** A category the user chose instead of the proposal, and the sort that recorded it (undone with it). */
export interface LearnedChoice {
  category: string;
  run: string;
}

/** The user's corrections, by address and by site: the next sort follows them. */
export interface Learned {
  urls: Record<string, LearnedChoice>;
  domains: Record<string, LearnedChoice>;
}

export async function loadLearned(): Promise<Learned> {
  const { learned } = await local.get('learned');
  const l = learned as Partial<Learned> | undefined;
  return { urls: l?.urls ?? {}, domains: l?.domains ?? {} };
}

export async function saveLearned(l: Learned): Promise<void> {
  await local.set({ learned: l });
  // Corrections of 0.2 pointed at folders that a rebuild archives: they no longer mean anything.
  await local.remove('examples');
}

/** Forgets the corrections recorded by a sort that was undone. */
export async function forgetRun(run: string): Promise<void> {
  const l = await loadLearned();
  const keep = (r: Record<string, LearnedChoice>) => Object.fromEntries(Object.entries(r).filter(([, c]) => c.run !== run));
  await saveLearned({ urls: keep(l.urls), domains: keep(l.domains) });
}

export async function hasHistoryPermission(): Promise<boolean> {
  return browser.permissions.contains({ permissions: ['history'] });
}

/** Must be called from a user gesture (click). */
export async function requestHistoryPermission(): Promise<boolean> {
  return browser.permissions.request({ permissions: ['history'] });
}

export async function removeHistoryPermission(): Promise<void> {
  await browser.permissions.remove({ permissions: ['history'] });
}

/** A folder created by a sort: the group or category it holds, and its name (its title may be an emoji only). */
export interface KnownFolder {
  group?: GroupId;
  category?: string;
  name?: string;
}
export type KnownFolders = Map<string, KnownFolder>;

/** Folders created by Nidomark, with the group or category they hold: recognised at the next sort. */
export async function loadKnownFolders(): Promise<KnownFolders> {
  const { knownFolders } = await local.get('knownFolders');
  return new Map(Object.entries((knownFolders as Record<string, KnownFolder> | undefined) ?? {}));
}

export async function saveKnownFolders(known: KnownFolders): Promise<void> {
  await local.set({ knownFolders: Object.fromEntries(known) });
}

export interface BackupRecord {
  id: string;
  title: string;
  createdAt: number;
  count?: number;
}

/** Backup folders created before a sort, newest first. */
export async function loadBackups(): Promise<BackupRecord[]> {
  const { backups } = await local.get('backups');
  return ((backups as BackupRecord[] | undefined) ?? []).sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveBackups(list: BackupRecord[]): Promise<void> {
  await local.set({ backups: list });
}

/** Reading a bookmarked page needs access to sites; it is asked for once, when the user starts an analysis. */
export const SITE_ORIGINS = ['http://*/*', 'https://*/*'];

export async function hasSitesPermission(): Promise<boolean> {
  return browser.permissions.contains({ origins: SITE_ORIGINS });
}

/** Must be called from a user gesture (click). */
export async function requestSitesPermission(): Promise<boolean> {
  return browser.permissions.request({ origins: SITE_ORIGINS });
}

/** Asks for what is missing in one browser prompt; must be called from a user gesture (click). */
export async function requestPermissions(want: { history: boolean; sites: boolean }): Promise<boolean> {
  if (!want.history && !want.sites) return true;
  return browser.permissions.request({ permissions: want.history ? ['history'] : [], origins: want.sites ? SITE_ORIGINS : [] });
}

export async function removeSitesPermission(): Promise<void> {
  await browser.permissions.remove({ origins: SITE_ORIGINS });
}
