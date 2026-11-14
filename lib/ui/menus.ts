import type { Analysis } from '../analyze';
import type { SuggestionTarget } from '../edit';
import { isWithin } from '../edit';
import { t } from '../i18n';
import type { Decisions, FolderParent } from '../plan';
import type { Target } from '../types';
import { VOCAB } from '../vocab';
import { openNewFolderDialog } from './dialogs';
import { closeMenus, h, icon, openMenu } from './dom';
import { bookmarkTitle, nodeTitle, rootTitle, suggestionLabel } from './shared';
import type { Actions } from './state';
import { type DestNode, type Layout, flatten } from './viewmodel';

function firstGrapheme(s: string): string {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s.trim())[Symbol.iterator]().next();
  return seg.done ? '' : seg.value.segment;
}

export function openEmojiMenu(anchor: HTMLElement, current: string, name: string, onPick: (emoji: string) => void): void {
  const pick = (e: string) => {
    onPick(e);
    closeMenus();
  };
  const input = h('input', { type: 'text', 'aria-label': t('customEmoji'), placeholder: t('customEmoji'), maxlength: 8 });
  const unique = [...new Set(VOCAB.map((v) => v.emoji))];
  openMenu(anchor, [
    h('div', { class: 'menu-label' }, t('emojiLabel', name)),
    h('div', { class: 'emoji-grid' }, unique.map((e) => h('button', { type: 'button', role: 'menuitemradio', 'aria-checked': String(e === current), 'aria-current': e === current ? 'true' : undefined, 'aria-label': e, onclick: () => pick(e) }, e))),
    h('hr'),
    h('button', { type: 'button', role: 'menuitem', onclick: () => pick('') }, icon('close'), t('noEmoji')),
    h('div', { class: 'emoji-custom' }, input, h('button', { type: 'button', class: 'btn btn-tonal', onclick: () => { const e = firstGrapheme(input.value); if (e) pick(e); } }, t('ok'))),
  ], t('emojiLabel', name));
}

/** A menu item: an icon or emoji, a label, the depth of the folder it stands for. */
function item(lead: Node | string, label: string, onClick: () => void, o: { level?: number; current?: boolean; title?: string } = {}): HTMLElement {
  return h('button', {
    type: 'button', role: 'menuitem', class: o.level && o.level > 1 ? 'nested' : undefined, style: o.level && o.level > 1 ? `--level:${Math.min(o.level, 6)}` : undefined,
    'aria-current': o.current ? 'true' : undefined, title: o.title,
    onclick: () => {
      closeMenus();
      onClick();
    },
  }, typeof lead === 'string' ? h('span', { class: 'emoji', 'aria-hidden': 'true' }, lead) : lead, h('span', null, label));
}

function folderLead(n: DestNode): Node | string {
  if (n.kind === 'review') return icon('help');
  if (n.kind === 'bar') return icon('bolt');
  if (n.kind === 'existing') return icon('subdirectory_arrow_right');
  return n.emoji || icon('folder');
}

/** The roots of the new tree, the bookmarks bar and Other bookmarks always among them. */
function rootsOf(an: Analysis, lay: Layout): { rootId: string; nodes: DestNode[] }[] {
  const ids = [an.snapshot.barId, an.snapshot.otherId].filter((x): x is string => !!x);
  const out = ids.map((rootId) => lay.roots.find((r) => r.rootId === rootId) ?? { rootId, nodes: [] });
  return [...out, ...lay.roots.filter((r) => !ids.includes(r.rootId))];
}

/** Moves a bookmark: the suggestions first, then quick access and every folder of the new tree, as a tree. */
export function openMoveMenu(anchor: HTMLElement, an: Analysis, d: Decisions, a: Actions, lay: Layout, id: string, suggestions: SuggestionTarget[] = []): void {
  const now = lay.where.get(id);
  const go = (target: Target) => a.move(id, target);
  const items: HTMLElement[] = [h('div', { class: 'menu-label' }, t('moveTo'))];
  for (const s of suggestions) items.push(item(icon('auto_awesome'), `${s.emoji} ${s.name}`, () => a.acceptSuggestion(id, s.category), { title: suggestionLabel(s) }));
  if (suggestions.length) items.push(h('hr'));
  for (const root of rootsOf(an, lay)) {
    items.push(h('div', { class: 'menu-label' }, rootTitle(an, root.rootId)));
    if (root.rootId === an.snapshot.barId && !root.nodes.some((n) => n.kind === 'bar')) items.push(item(icon('bolt'), t('nodeBar'), () => go({ kind: 'bar' })));
    for (const n of flatten(root.nodes)) {
      const target: Target | null = n.kind === 'bar' ? { kind: 'bar' } : n.folder ? { kind: 'new', key: n.folder } : n.kind === 'existing' ? { kind: 'existing', folderId: n.key.slice(2) } : null;
      if (target) items.push(item(folderLead(n), nodeTitle(n), () => go(target), { level: n.level, current: now === n.key }));
    }
    if (root.rootId !== an.snapshot.barId && !root.nodes.some((n) => n.key === `e:${root.rootId}`)) items.push(item(icon('subdirectory_arrow_right'), t('nodeLoose'), () => go({ kind: 'existing', folderId: root.rootId })));
  }
  items.push(h('hr'), item(icon('create_new_folder'), t('newFolderOption'), () => {
    const at = now ? lay.byKey.get(now) : undefined;
    openNewFolderDialog(an, lay, at?.folder ? { key: at.folder } : null, (name, parent) => a.createFolder(name, parent, id));
  }));
  openMenu(anchor, items, `${t('moveTo')} : ${bookmarkTitle(an, d, id)}`);
}

/** Moves a folder: to the top of a root folder or into another folder, never into itself. */
export function openFolderMoveMenu(anchor: HTMLElement, an: Analysis, a: Actions, lay: Layout, node: DestNode): void {
  const key = node.folder as string;
  const parent = lay.parent.get(node.key);
  const go = (p: FolderParent) => a.moveFolder(key, p);
  const items: HTMLElement[] = [h('div', { class: 'menu-label' }, t('moveFolderTo', node.name))];
  for (const root of rootsOf(an, lay)) {
    items.push(item(icon('vertical_align_top'), t('atTopOf', rootTitle(an, root.rootId)), () => go({ rootId: root.rootId }), { current: !parent && node.rootId === root.rootId }));
    for (const n of flatten(root.nodes)) {
      if (!n.folder || isWithin(lay.tree, n.folder, key)) continue;
      items.push(item(folderLead(n), nodeTitle(n), () => go({ key: n.folder as string }), { level: n.level + 1, current: parent === n.key }));
    }
  }
  openMenu(anchor, items, t('moveFolderTo', node.name));
}

export interface RowMenu {
  an: Analysis;
  d: Decisions;
  a: Actions;
  lay: Layout;
  node: DestNode;
  id: string;
  suggestions: SuggestionTarget[];
}

/** Everything that can be done to a bookmark: move, rename, show as an icon, open, remove or bring back. */
export function openRowMenu(anchor: HTMLElement, m: RowMenu): void {
  const { an, d, a, id, node } = m;
  const url = an.snapshot.bookmarks.get(id)?.url ?? '';
  const out = node.kind === 'dupes' || node.kind === 'removed';
  const items: HTMLElement[] = [];
  if (out) items.push(item(icon('restore'), node.kind === 'dupes' ? t('keepDupe') : t('restore'), () => a.restoreBookmarks([id])));
  else {
    items.push(h('button', { type: 'button', role: 'menuitem', 'aria-haspopup': 'menu', onclick: () => openMoveMenu(anchor, an, d, a, m.lay, id, m.suggestions) }, icon('drive_file_move'), h('span', null, t('moveToEllipsis'))));
    items.push(item(icon('edit'), t('rename'), () => a.startRename(id)));
    // Only right in the bookmarks bar can a bookmark show its icon alone: in a folder, the browser shows the address.
    if (node.kind === 'bar') {
      const on = !!d.iconOnly[id];
      items.push(h('button', { type: 'button', role: 'menuitemcheckbox', 'aria-checked': String(on), onclick: () => { closeMenus(); a.toggleIconOnly(id); } }, icon(on ? 'check_box' : 'check_box_outline_blank'), h('span', null, t('iconOnlyItem'))));
    }
    const tt = d.titles[id];
    if (tt && an.proposal.titles[id]) items.push(item(icon('restart_alt'), tt.accepted ? t('keepTitle') : t('useNewTitle'), () => a.toggleTitle(id)));
  }
  if (/^https?:/i.test(url)) items.push(item(icon('open_in_new'), t('openPage'), () => window.open(url, '_blank', 'noopener,noreferrer')));
  if (!out) items.push(h('hr'), item(icon('delete'), t('removeBookmark'), () => a.removeBookmark(id)));
  openMenu(anchor, items, bookmarkTitle(an, d, id) || t('unnamed'));
}
