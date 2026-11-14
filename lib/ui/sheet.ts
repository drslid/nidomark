import type { Analysis } from '../analyze';
import { foldersUnder, sameTarget } from '../edit';
import { t } from '../i18n';
import type { Decisions, FolderStyle } from '../plan';
import type { Placement } from '../types';
import { openDeleteFolderDialog, openNewFolderDialog } from './dialogs';
import { draggable } from './dnd';
import { favicon, h, icon } from './dom';
import { openEmojiMenu, openFolderMoveMenu, openRowMenu } from './menus';
import { bookmarkTitle, host, nodePath, nodeTitle, ownEmoji, reasonText, rootTitle, suggestionLabel, suggestionsFor } from './shared';
import type { Actions, State } from './state';
import { segmented } from './views';
import { type DestNode, type Layout, nodeKeyOf } from './viewmodel';

const STATIC_TILES: Record<string, [string, string]> = {
  bar: ['bolt', 'tile-quick'],
  dupes: ['content_copy', ''],
  removed: ['delete', ''],
  existing: ['subdirectory_arrow_right', ''],
};

function renameField(a: Actions, id: string, title: string): HTMLInputElement {
  let done = false;
  const input = h('input', { class: 'name-field name-row', type: 'text', value: title, maxlength: 200, dir: 'auto', 'aria-label': t('renameLabel', title), 'data-focus': `rename-${id}` });
  const finish = (save: boolean) => {
    if (done) return;
    done = true;
    const v = input.value.trim();
    if (save && v && v !== title) a.renameBookmark(id, v);
    else a.startRename(null);
  };
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  return input;
}

function chip(iconName: string, label: string, focus: string, onClick: (e: Event) => void, extra = ''): HTMLElement {
  return h('button', { class: `chip chip-action ${extra}`.trim(), type: 'button', 'data-focus': focus, onclick: onClick }, icon(iconName, undefined, 'icon-sm'), h('span', null, label));
}

export function sheetView(s: State, a: Actions, an: Analysis, d: Decisions, node: DestNode, lay: Layout): HTMLElement {
  const placements = new Map<string, Placement>(an.proposal.placements.map((p) => [p.bookmarkId, p]));
  /** Why a bookmark is where it is: the proposal's reason, or the user's own choice. */
  const reasonOf = (id: string): string => {
    const pl = placements.get(id);
    const m = d.moves[id];
    if (pl && (!m || sameTarget(m.target, pl.target))) return reasonText(pl.reason);
    return t('reasonUser');
  };
  // A reason most bookmarks share is said once, under the title; the others are said on their row.
  const counts = new Map<string, number>();
  if (node.kind !== 'review') for (const id of node.ids) counts.set(reasonOf(id), (counts.get(reasonOf(id)) ?? 0) + 1);
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  const shared = top && top[1] >= Math.max(2, node.ids.length / 2) ? top[0] : null;
  const folder = node.kind === 'new' || node.kind === 'review';
  const key = node.folder ?? '';
  const title = nodeTitle(node);

  const close = h('button', { class: 'icon-btn', 'aria-label': t('sheetClose'), title: t('sheetClose'), 'data-focus': 'sheet-close', onclick: () => a.select(null) }, icon('close'));
  let head: HTMLElement;
  if (folder && !node.existing) {
    const tile = ownEmoji(node) || icon(node.kind === 'review' ? 'help' : 'folder');
    head = h('div', { class: 'sheet-head' },
      h('button', { class: `tile-btn${node.kind === 'review' ? ' tile-review' : ''}`, 'aria-label': t('emojiLabel', title), title: t('emojiLabel', title), 'data-focus': 'sheet-emoji', onclick: (e: Event) => openEmojiMenu(e.currentTarget as HTMLElement, node.emoji, title, (emoji) => a.setNewFolder(key, { emoji })) }, tile),
      h('div', { class: 'grow' }, h('input', { class: 'name-field', type: 'text', value: node.name, 'aria-label': t('folderName'), 'data-focus': 'sheet-name', maxlength: 60, onchange: (e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) a.setNewFolder(key, { name: v }); } })),
      close);
  } else {
    const [iconName, extra] = STATIC_TILES[node.kind] ?? ['folder', ''];
    const tile = node.existing && node.emoji ? node.emoji : icon(iconName);
    head = h('div', { class: 'sheet-head' }, h('span', { class: `tile-btn tile-static ${extra}`.trim() }, tile), h('div', { class: 'grow' }, h('h2', { id: 'sheet-title' }, title)), close);
  }

  let sub: string | null;
  if (node.existing) sub = t('existingFolderHint');
  else if (folder) sub = node.kind === 'review' ? (node.ids.every((id) => placements.get(id)?.reason.key === 'reviewNoAccess') ? t('reviewHintUntested') : t('reviewHint')) : shared;
  else if (node.kind === 'bar') sub = t('barSheetHint');
  else if (node.kind === 'dupes') sub = t('dupesHint');
  else if (node.kind === 'removed') sub = t('removedHint');
  else sub = t('looseHint', rootTitle(an, node.rootId));

  const tools: HTMLElement[] = [];
  if (folder) {
    const withSuggestions = node.kind === 'review' ? node.ids.filter((id) => an.proposal.suggestions[id]?.length) : [];
    if (withSuggestions.length) tools.push(chip('auto_awesome', t('acceptAll', withSuggestions.length.toLocaleString()), 'tool-accept', () => a.acceptAllSuggestions(), 'chip-suggest'));
    const parentNode = lay.byKey.get(lay.parent.get(node.key) ?? '');
    const into = parentNode ? nodeTitle(parentNode) : rootTitle(an, node.rootId);
    // To check is a waiting room: its sheet keeps to filing what it holds.
    if (node.kind === 'new') tools.push(chip('create_new_folder', t('newSubfolder'), 'tool-sub', () => openNewFolderDialog(an, lay, { key }, (name, parent) => a.select(nodeKeyOf(a.createFolder(name, parent))))));
    if (node.kind === 'new' && !node.existing) tools.push(chip('drive_file_move', t('moveFolder'), 'tool-move', (e) => openFolderMoveMenu(e.currentTarget as HTMLElement, an, a, lay, node)));
    tools.push(chip('refresh', t('reanalyze'), 'tool-reanalyze', () => a.reanalyze(node.key)));
    if (node.kind === 'new' && !node.existing) {
      tools.push(chip('delete', t('deleteFolder'), 'tool-delete', () => {
        const folders = foldersUnder(lay.tree, key).length;
        if (!node.count && !folders) a.deleteFolder(key, false);
        else openDeleteFolderDialog(title, node.count, folders, into, (all) => a.deleteFolder(key, all));
      }));
    }
  } else if (node.kind === 'dupes') tools.push(chip('restore', t('keepAllDupes'), 'sheet-keep-dupes', () => a.restoreBookmarks(node.ids)));
  else if (node.kind === 'removed') tools.push(chip('restore', t('restoreAll'), 'sheet-restore-all', () => a.restoreBookmarks(node.ids)));

  const display = node.kind === 'new' && !node.existing
    ? h('div', { class: 'sheet-display' },
      h('span', { class: 'small muted' }, t('displayInBrowser')),
      segmented(`style-${key}`, node.style ?? d.folderStyle, [['emoji', t('styleEmoji')], ['emoji-name', t('styleEmojiName')], ['name', t('styleName')]], (v: FolderStyle) => a.setNewFolder(key, { style: v }), t('displayInBrowser')))
    : null;

  // Bookmarks to check and dead sites can be opened right away, to see for oneself.
  const openable = node.kind === 'review' || key === 'c:dead';
  const row = (id: string): HTMLElement => {
    const b = an.snapshot.bookmarks.get(id);
    const name = bookmarkTitle(an, d, id) || t('unnamed');
    const reason = reasonOf(id);
    const why = reason !== shared ? reason : null;
    const suggestions = node.kind === 'review' ? suggestionsFor(an, lay, id) : [];
    const renaming = s.renaming === id;
    const iconOnly = node.kind === 'bar' && !!d.iconOnly[id];
    const li = h('li', { class: 'row', 'data-id': id },
      favicon(b?.url ?? '', 20),
      h('div', { class: 'row-text' },
        // A title takes its own direction: a French title stays readable, and cut at its end, in an Arabic interface.
        renaming ? renameField(a, id, bookmarkTitle(an, d, id)) : h('span', { class: 'title', dir: 'auto', title: name, ondblclick: () => a.startRename(id) }, name),
        h('span', { class: 'sub' }, iconOnly ? `${host(b?.url ?? '')} · ${t('iconOnly')}` : host(b?.url ?? '')),
        why ? h('span', { class: 'why', id: `why-${id}` }, why) : null,
        suggestions.length
          ? h('div', { class: 'suggests', role: 'group', 'aria-label': t('suggestionsFor', name) }, suggestions.map((sg, i) =>
            h('button', { class: `suggest${i ? ' alt' : ''}`, type: 'button', title: suggestionLabel(sg), 'aria-label': t('fileIn', suggestionLabel(sg)), 'data-focus': `sug-${id}-${i}`, onclick: () => a.acceptSuggestion(id, sg.category) },
              i === 0 ? icon('auto_awesome', undefined, 'icon-sm') : null, h('span', null, `${sg.emoji} ${sg.name}`))))
          : null),
      h('span', { class: 'row-actions' },
        openable && /^https?:/i.test(b?.url ?? '') ? h('a', { class: 'icon-btn', href: b?.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('openSite', name), title: t('openSite', name), 'data-focus': `open-${id}` }, icon('open_in_new')) : null,
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': t('rowActions', name), title: t('rowActions', name), 'aria-describedby': why ? `why-${id}` : undefined, 'aria-haspopup': 'menu', 'data-focus': `more-${id}`, onclick: (e: Event) => openRowMenu(e.currentTarget as HTMLElement, { an, d, a, lay, node, id, suggestions }) }, icon('more_vert'))));
    return renaming ? li : draggable(li, () => ({ kind: 'bookmark', id }), () => name);
  };

  const subfolders = node.children.length
    ? h('section', { class: 'subfolders', 'aria-labelledby': 'subfolders-title' },
      h('h3', { class: 'list-label', id: 'subfolders-title' }, t('subfolders')),
      h('ul', { class: 'rows' }, node.children.map((c) => h('li', null,
        h('button', { class: 'subrow', type: 'button', 'data-focus': `sub-${c.key}`, onclick: () => a.select(c.key) },
          h('span', { class: 'tile', 'aria-hidden': 'true' }, c.style !== 'name' && c.emoji ? c.emoji : icon('folder', undefined, 'icon-sm')),
          h('span', { class: 'grow' }, nodeTitle(c)),
          h('span', { class: 'count' }, c.count.toLocaleString()),
          icon('chevron_right', undefined, 'icon-sm'))))))
    : null;
  const empty = !node.ids.length && !node.children.length;
  return h('aside', { class: 'sheet', id: 'sheet', 'aria-label': title, inert: s.busy ? true : undefined },
    head,
    folder ? h('p', { class: 'sheet-path small' }, [...nodePath(an, lay, node.key), title].join(' › ')) : null,
    sub && h('p', { class: 'sheet-sub' }, sub),
    display,
    tools.length ? h('div', { class: 'sheet-tools' }, tools) : null,
    empty
      ? h('div', { class: 'empty-drop' }, t('emptyFolder'))
      : h('div', { class: 'sheet-list', 'data-scroll': `sheet-${node.key}` },
        node.ids.length ? h('ul', { class: 'rows', 'aria-label': title }, node.ids.map(row)) : null,
        subfolders));
}
