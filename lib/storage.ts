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
  /** Copy the current tree into a dated folder before applying. */
  backup: boolean;
  /** Remove the copies of a page kept elsewhere. */
  removeDuplicates: boolean;
}

export const DEFAULT_SETTINGS: Settings = { folderStyle: 'emoji', iconOnlyBar: true, scopeFolderIds: [], scopeExcluded: [], destination: 'bar', readSites: true, checkDead: true, backup: true, removeDuplicates: true };

const local = browser.storage.local;

export async function loadSettings(): Promise<Settings> {
  const { settings } = await local.get('settings');
  const saved = (settings as Partial<Settings> & { sourceFolderIds?: string[] } | undefined) ?? {};
  // Before 0.2 only the direct content of chosen folders was sorted: that setting does not carry over.
  const { sourceFolderIds: _legacy, ...rest } = saved;
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

/** Bookmarks the user filed differently from the proposal: bookmarkId → folderId. */
export async function loadExamples(): Promise<Map<string, string>> {
  const { examples } = await local.get('examples');
  return new Map(Object.entries((examples as Record<string, string> | undefined) ?? {}));
}

export async function saveExamples(examples: Map<string, string>): Promise<void> {
  await local.set({ examples: Object.fromEntries(examples) });
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

export type KnownFolders = Map<string, { group?: GroupId; category?: string }>;

/** Folders created by Nidomark, with the group or category they hold: recognised at the next sort. */
export async function loadKnownFolders(): Promise<KnownFolders> {
  const { knownFolders } = await local.get('knownFolders');
  return new Map(Object.entries((knownFolders as Record<string, { group?: GroupId; category?: string }> | undefined) ?? {}));
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

export async function removeSitesPermission(): Promise<void> {
  await browser.permissions.remove({ origins: SITE_ORIGINS });
}
