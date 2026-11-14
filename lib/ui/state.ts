import type { Analysis, AnalysisPhase } from '../analyze';
import type { Decisions, FolderParent, FolderStyle, Journal } from '../plan';
import type { Destination } from '../categorize';
import type { BackupRecord, Settings } from '../storage';
import type { Target } from '../types';

export type View = 'start' | 'progress' | 'review' | 'done' | 'empty' | 'error';

/** A folder of the scope picker, with the number of bookmarks a sort would cover inside it. */
export interface ScopeFolder {
  id: string;
  title: string;
  /** Bookmarks inside, with everything below. */
  count: number;
  depth: number;
  isRoot: boolean;
  /** The bookmarks bar: its shortcuts come back first. */
  isBar: boolean;
  /** Checked: its bookmarks are sorted. */
  included: boolean;
}

/** What the start screen shows before any analysis. */
export interface Preview {
  /** Bookmarks the current choice covers. */
  count: number;
  folders: ScopeFolder[];
  urls: string[];
}

export interface State {
  tab: 'organize' | 'settings';
  view: View;
  settings: Settings;
  /** The permission to read the history was granted. */
  historyAllowed: boolean;
  /** The permission to read sites was granted. */
  sitesAllowed: boolean;
  /** Root folders unfolded in the scope picker. */
  expandedScope: string[];
  moreOptions: boolean;
  backups: BackupRecord[];
  preview: Preview | null;
  progress: { phase: AnalysisPhase | 'applying'; done: number; total: number };
  analysis: Analysis | null;
  decisions: Decisions | null;
  /** Node open in the side sheet. */
  selected: string | null;
  /** Folders folded on the canvas (node keys). */
  collapsed: string[];
  /** Bookmark whose name is being edited in the sheet. */
  renaming: string | null;
  /** Bookmarks checked in the side sheet, to move or remove together. */
  checked: string[];
  /** A folder being analysed again: its name and the progress. */
  busy: { name: string; phase: AnalysisPhase; done: number; total: number } | null;
  /** What the last edit did, offered for undo. */
  snack: { text: string; undo: boolean } | null;
  /** Edits that can be undone. */
  canUndo: boolean;
  /** Connectors get their entrance motion once per proposal. */
  wiresDrawn: boolean;
  changedDuringReview: boolean;
  /** Bookmarks recreated (or changes undone), folders created, changes skipped, and the archive of the old tree. */
  result: { done: number; folders: number; skipped: number; undone?: boolean; archive?: string } | null;
  error: string | null;
  lastJournal: Journal | null;
  iconOnlyCount: number;
  status: string;
}

export interface Actions {
  setTab(tab: State['tab']): void;
  setUseHistory(on: boolean): void;
  setQuickAccess(n: number): void;
  setFolderStyle(style: FolderStyle): void;
  setIconOnlyDefault(on: boolean): void;
  analyze(): void;
  select(key: string | null): void;
  move(id: string, target: Target): void;
  /** Checks or unchecks a bookmark of the sheet; with `range`, every bookmark from the last one checked. */
  toggleChecked(id: string, range: boolean): void;
  setChecked(ids: string[]): void;
  moveMany(ids: string[], target: Target): void;
  removeMany(ids: string[]): void;
  toggleTitle(id: string): void;
  toggleIconOnly(id: string): void;
  renameBookmark(id: string, title: string): void;
  startRename(id: string | null): void;
  removeBookmark(id: string): void;
  restoreBookmarks(ids: string[]): void;
  setNewFolder(key: string, patch: Partial<{ name: string; emoji: string; style: FolderStyle }>): void;
  /** Creates a folder of the user's own (and files bookmarks in it); returns its folder key. */
  createFolder(name: string, parent: FolderParent, moveIds?: string[]): string;
  moveFolder(key: string, parent: FolderParent): void;
  /** Removes a folder: what it holds goes up to the folder above, or is not recreated either. */
  deleteFolder(key: string, withContent: boolean): void;
  toggleCollapsed(nodeKey: string): void;
  acceptSuggestion(id: string, category: string): void;
  acceptAllSuggestions(): void;
  /** Analyses the bookmarks of a folder again, its subfolders included. */
  reanalyze(nodeKey: string): void;
  undoEdit(): void;
  dismissSnack(): void;
  restoreProposal(): void;
  apply(): void;
  undo(): void;
  keepInterrupted(): void;
  backToStart(): void;
  toggleScope(folderId: string, included: boolean): void;
  toggleExpanded(folderId: string): void;
  toggleMoreOptions(): void;
  setDestination(d: Destination): void;
  setOption(key: 'readSites' | 'checkDead' | 'removeDuplicates', on: boolean): void;
  deleteBackup(id: string): void;
  restoreNames(): void;
  clearCache(): void;
}
