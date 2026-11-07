/** How the user relies on a bookmark, independently of its subject. */
export type Usage = 'access' | 'tool' | 'learn' | 'read' | 'follow';

export const USAGES: readonly Usage[] = ['access', 'tool', 'learn', 'read', 'follow'];

export interface BookmarkItem {
  id: string;
  parentId: string;
  index: number;
  title: string;
  url: string;
  dateAdded?: number;
  syncing?: boolean;
  /** Titles of the ancestor folders, root excluded. */
  folderPath: string[];
  inBar: boolean;
  /** Managed by a policy: never moved or renamed. */
  unmodifiable?: boolean;
}

export interface FolderItem {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  path: string[];
  depth: number;
  /** 'bookmarks-bar' | 'other' | 'mobile' | 'managed' for permanent folders (Chrome 134+). */
  folderType?: string;
  isRoot: boolean;
  inBar: boolean;
  bookmarkIds: string[];
  folderIds: string[];
  syncing?: boolean;
  /** Managed by a policy (Chrome's "managed bookmarks"): never a source nor a destination. */
  unmodifiable?: boolean;
}

export interface Snapshot {
  takenAt: number;
  barId?: string;
  otherId?: string;
  mobileId?: string;
  bookmarks: Map<string, BookmarkItem>;
  folders: Map<string, FolderItem>;
}

export interface HistoryInfo {
  title?: string;
  visitCount: number;
  typedCount: number;
}

export interface Features {
  id: string;
  host: string;
  registrable: string;
  port: string;
  pathWords: string;
  privateHost: boolean;
  remoteAccessHost: boolean;
  knownApp: string | null;
  articlePath: boolean;
  vagueTitle: boolean;
  /** Best human title: bookmark title, or the real page title when the bookmark title is vague. */
  bestTitle: string;
  /** Cleaned title proposed to the user, when different from the current one. */
  cleanTitle: string | null;
  usage: Usage;
  usageScores: Record<Usage, number>;
  signals: string[];
  insufficient: boolean;
  /** Text given to the embedding model. */
  text: string;
  words: string[];
  visits: number;
}

/** Translated, user-facing explanation: an i18n key and its substitutions. */
export interface Reason {
  key: string;
  subs?: string[];
}

export type Target = { kind: 'existing'; folderId: string } | { kind: 'new'; key: string } | { kind: 'stay' };

export interface Placement {
  bookmarkId: string;
  target: Target;
  reason: Reason;
}

export interface NewFolder {
  key: string;
  vocabId: string | null;
  name: string;
  emoji: string;
  parentId: string;
  reason: Reason;
}

export interface ReviewItem {
  bookmarkId: string;
  reason: Reason;
}

export interface Proposal {
  snapshotTakenAt: number;
  placements: Placement[];
  newFolders: NewFolder[];
  review: ReviewItem[];
  /** Cleaned or better titles for bookmarks: bookmarkId → title. */
  titles: Record<string, string>;
  /** Emoji suggested for existing folders: folderId → emoji. */
  folderEmojis: Record<string, string>;
}
