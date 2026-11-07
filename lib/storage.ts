import { browser } from 'wxt/browser';
import type { FolderStyle, Journal, JournalStore } from './plan';

export interface Settings {
  folderStyle: FolderStyle;
  iconOnlyBar: boolean;
  /** Folders whose direct bookmarks may be moved; empty = "Other bookmarks". */
  sourceFolderIds: string[];
}

export const DEFAULT_SETTINGS: Settings = { folderStyle: 'emoji-name', iconOnlyBar: true, sourceFolderIds: [] };

const local = browser.storage.local;

export async function loadSettings(): Promise<Settings> {
  const { settings } = await local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings as Partial<Settings> | undefined) };
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
