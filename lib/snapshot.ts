import type { BookmarkItem, FolderItem, Snapshot } from './types';

/** Subset of a bookmarks tree node, common to Chrome and Firefox. */
export interface TreeNode {
  id: string;
  parentId?: string;
  index?: number;
  title: string;
  url?: string;
  dateAdded?: number;
  folderType?: string;
  syncing?: boolean;
  unmodifiable?: string;
  children?: TreeNode[];
}

/** Permanent folders: `folderType` (Chrome 134+), else the well-known ids of Chrome and Firefox. */
function permanentKind(node: TreeNode): 'bar' | 'other' | 'mobile' | 'menu' | null {
  switch (node.folderType) {
    case 'bookmarks-bar': return 'bar';
    case 'other': return 'other';
    case 'mobile': return 'mobile';
  }
  switch (node.id) {
    case '1': case 'toolbar_____': return 'bar';
    case '2': case 'unfiled_____': return 'other';
    case '3': case 'mobile______': return 'mobile';
    case 'menu________': return 'menu';
  }
  return null;
}

export function buildSnapshot(tree: TreeNode[], takenAt = Date.now()): Snapshot {
  const snapshot: Snapshot = { takenAt, bookmarks: new Map(), folders: new Map() };
  const root = tree[0];
  if (!root) return snapshot;

  const walk = (node: TreeNode, path: string[], depth: number, inBar: boolean, isRoot: boolean, locked: boolean, parentId: string | undefined) => {
    // Before Chrome 134 managed bookmarks are only recognisable by `unmodifiable`; it applies to the whole subtree.
    const unmodifiable = locked || !!node.unmodifiable || node.folderType === 'managed';
    const folder: FolderItem = {
      id: node.id, parentId: node.parentId ?? parentId, index: node.index, title: node.title, path, depth,
      folderType: node.folderType, isRoot, inBar, bookmarkIds: [], folderIds: [], syncing: node.syncing, unmodifiable,
    };
    snapshot.folders.set(node.id, folder);
    for (const child of node.children ?? []) {
      if (child.url !== undefined) {
        const b: BookmarkItem = {
          id: child.id, parentId: node.id, index: child.index ?? 0, title: child.title, url: child.url,
          dateAdded: child.dateAdded, syncing: child.syncing, folderPath: isRoot ? [] : [...path, node.title], inBar,
          unmodifiable: unmodifiable || !!child.unmodifiable,
        };
        snapshot.bookmarks.set(child.id, b);
        folder.bookmarkIds.push(child.id);
      } else {
        folder.folderIds.push(child.id);
        walk(child, isRoot ? [] : [...path, node.title], depth + 1, inBar, false, unmodifiable, node.id);
      }
    }
  };

  for (const top of root.children ?? []) {
    const kind = permanentKind(top);
    if (kind === 'bar') snapshot.barId ??= top.id;
    if (kind === 'other') snapshot.otherId ??= top.id;
    if (kind === 'mobile') snapshot.mobileId ??= top.id;
    walk(top, [], 0, kind === 'bar', true, false, root.id);
  }
  return snapshot;
}
