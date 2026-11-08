import type { Analysis, AnalysisPhase } from '../analyze';
import type { Decisions, FolderStyle, Journal } from '../plan';
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
  useHistory: boolean;
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
  /** Connectors get their entrance motion once per proposal. */
  wiresDrawn: boolean;
  changedDuringReview: boolean;
  result: { done: number; skipped: number; undone?: boolean } | null;
  error: string | null;
  lastJournal: Journal | null;
  iconOnlyCount: number;
  status: string;
}

export interface Actions {
  setTab(tab: State['tab']): void;
  setUseHistory(on: boolean): void;
  setFolderStyle(style: FolderStyle): void;
  setIconOnlyDefault(on: boolean): void;
  analyze(): void;
  select(key: string | null): void;
  move(id: string, target: Target): void;
  toggleTitle(id: string): void;
  toggleIconOnly(id: string): void;
  setNewFolder(key: string, patch: Partial<{ name: string; emoji: string; accepted: boolean }>): void;
  setFolderEmoji(folderId: string, emoji: string): void;
  /** Creates a folder of the user's own; returns its node key. */
  createFolder(name: string): string;
  rejectAll(): void;
  restoreProposal(): void;
  apply(): void;
  undo(): void;
  keepInterrupted(): void;
  backToStart(): void;
  toggleScope(folderId: string, included: boolean): void;
  toggleExpanded(folderId: string): void;
  toggleMoreOptions(): void;
  setDestination(d: Destination): void;
  setOption(key: 'readSites' | 'checkDead' | 'backup' | 'removeDuplicates', on: boolean): void;
  keepAllDuplicates(): void;
  deleteBackup(id: string): void;
  restoreNames(): void;
  clearCache(): void;
}
