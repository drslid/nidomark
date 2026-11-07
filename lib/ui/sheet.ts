import type { Analysis } from '../analyze';
import { t } from '../i18n';
import type { Decisions } from '../plan';
import type { FolderItem, Reason } from '../types';
import { VOCAB, stripEmoji } from '../vocab';
import { closeMenus, favicon, h, icon, openMenu } from './dom';
import type { Actions } from './state';
import { type DestNode, folderEmoji, keyToTarget, nodeOf, targetKey } from './viewmodel';

/** Drag-and-drop payload type for a bookmark id. */
export const DRAG_TYPE = 'application/x-nidomark-bookmark';

export function reasonText(r: Reason): string {
  return t(r.key, ...(r.subs ?? []));
}

/** Title shown for a bookmark: the accepted cleaner title, or the current one. */
export function bookmarkTitle(an: Analysis, d: Decisions, id: string): string {
  const tt = d.titles[id];
  return tt?.accepted ? tt.title : (an.snapshot.bookmarks.get(id)?.title ?? '');
}

/** "Bookmarks bar › Tools" for a folder. */
export function folderPathLabel(an: Analysis, f: FolderItem): string {
  let top: FolderItem | undefined = f;
  while (top?.parentId && !an.snapshot.folders.get(top.parentId)?.isRoot) top = an.snapshot.folders.get(top.parentId);
  const rootId = top?.parentId;
  const root = rootId === an.snapshot.barId ? t('barFolder') : rootId === an.snapshot.otherId ? t('otherFolder') : (an.snapshot.folders.get(rootId ?? '')?.title ?? '');
  return [root, ...f.path].filter(Boolean).join(' › ');
}

export function destinationFolders(an: Analysis): FolderItem[] {
  const sources = new Set(an.sourceFolderIds);
  return [...an.snapshot.folders.values()].filter((f) => !f.isRoot && !sources.has(f.id) && !f.unmodifiable);
}

export function openNewFolderDialog(onCreate: (name: string) => void): void {
  const input = h('input', { type: 'text', id: 'new-folder-name', maxlength: 60, autocomplete: 'off', placeholder: t('folderName'), required: true });
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'new-folder-title' });
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'new-folder-title' }, t('dialogNewFolderTitle')),
    h('div', { class: 'field' }, h('label', { for: 'new-folder-name', class: 'visually-hidden' }, t('folderName')), input),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-text', onclick: () => dialog.close() }, t('cancel')),
      h('button', { type: 'submit', class: 'btn btn-filled' }, t('create'))));
  form.addEventListener('submit', () => {
    const name = input.value.trim();
    if (name) onCreate(name);
  });
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}

function firstGrapheme(s: string): string {
  const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s.trim())[Symbol.iterator]().next();
  return seg.done ? '' : seg.value.segment;
}

function openEmojiMenu(anchor: HTMLElement, current: string, name: string, onPick: (emoji: string) => void): void {
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

function openMoveMenu(anchor: HTMLElement, an: Analysis, d: Decisions, a: Actions, id: string): void {
  const current = nodeOf(an, d, id);
  const go = (key: string) => {
    a.move(id, keyToTarget(key));
    closeMenus();
  };
  const item = (key: string, emoji: string, label: string) =>
    h('button', { type: 'button', role: 'menuitem', 'aria-current': key === current ? 'true' : undefined, onclick: () => go(key) },
      emoji ? h('span', { class: 'emoji', 'aria-hidden': 'true' }, emoji) : icon('folder'), h('span', null, label));
  const fresh = an.proposal.newFolders.filter((f) => d.newFolders[f.key]?.accepted).map((f) => item(`n:${f.key}`, d.newFolders[f.key]?.emoji ?? '', d.newFolders[f.key]?.name ?? f.name));
  const existing = destinationFolders(an).map((f) => item(`e:${f.id}`, d.folderStyle !== 'name' ? folderEmoji(d, f) : '', `${stripEmoji(f.title) || f.title}`));
  const tt = d.titles[id];
  const items: HTMLElement[] = [
    h('div', { class: 'menu-label' }, t('moveTo')),
    ...fresh,
    ...existing,
    h('hr'),
    h('button', { type: 'button', role: 'menuitem', 'aria-current': current === 'stay' || current === 'review' ? 'true' : undefined, onclick: () => go('stay') }, icon('push_pin'), t('dontMove')),
    h('button', { type: 'button', role: 'menuitem', onclick: () => { closeMenus(); openNewFolderDialog((name) => a.move(id, keyToTarget(a.createFolder(name)))); } }, icon('create_new_folder'), t('newFolderOption')),
  ];
  if (tt) items.push(h('hr'), h('button', { type: 'button', role: 'menuitem', onclick: () => { a.toggleTitle(id); closeMenus(); } }, icon('restart_alt'), tt.accepted ? t('keepTitle') : t('useNewTitle')));
  openMenu(anchor, items, t('moveTo'));
}

/** Why a bookmark is where it is: the proposal's reason, or the user's own choice. */
function rowReason(an: Analysis, d: Decisions, id: string): string {
  const placement = an.proposal.placements.find((p) => p.bookmarkId === id);
  const review = an.proposal.review.find((r) => r.bookmarkId === id);
  const m = d.moves[id];
  const proposedKey = placement ? targetKey(placement.target) : 'stay';
  const nowKey = m?.accepted ? targetKey(m.target) : 'stay';
  if (review && !m?.accepted) return reasonText(review.reason);
  if (placement && proposedKey === nowKey) return reasonText(placement.reason);
  return t('reasonUser');
}

function host(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return url;
  }
}

/** The reason most bookmarks of a node share, shown once under its title instead of on every row. */
function sharedReason(an: Analysis, d: Decisions, ids: string[]): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const r = rowReason(an, d, id);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const [top] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return top && top[1] >= Math.max(2, ids.length / 2) ? top[0] : null;
}

export function clearDropTargets(): void {
  document.querySelectorAll('.drop-target, .origin').forEach((el) => el.classList.remove('drop-target', 'origin'));
  document.querySelector('.board')?.classList.remove('drag-active');
}

export function sheetView(a: Actions, an: Analysis, d: Decisions, node: DestNode): HTMLElement {
  const close = h('button', { class: 'icon-btn', 'aria-label': t('sheetClose'), 'data-focus': 'sheet-close', onclick: () => a.select(null) }, icon('close'));
  let head: HTMLElement;
  let sub: string | null = null;
  let actions: HTMLElement | null = null;
  // A reason most bookmarks share is said once, under the title; the others are said on their row.
  const shared = node.kind === 'review' ? null : sharedReason(an, d, node.ids);
  if (node.kind === 'new') {
    const key = node.key.slice(2);
    const tileBtn = h('button', { class: 'tile-btn', 'aria-label': t('emojiLabel', node.name), 'data-focus': 'sheet-emoji', onclick: (e: Event) => openEmojiMenu(e.currentTarget as HTMLElement, node.emoji, node.name, (emoji) => a.setNewFolder(key, { emoji })) },
      node.emoji || icon('folder'));
    const name = h('input', { class: 'name-field', type: 'text', value: node.name, 'aria-label': t('folderName'), 'data-focus': 'sheet-name', maxlength: 60, onchange: (e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) a.setNewFolder(key, { name: v }); } });
    head = h('div', { class: 'sheet-head' }, tileBtn, h('div', { class: 'grow' }, name), close);
    sub = node.off ? t('nodeOffHint') : (shared ?? t('nodeNewHint'));
    actions = h('div', { class: 'sheet-actions' },
      h('span', { class: 'muted' }, t('countLabel', node.ids.length)),
      node.off
        ? h('button', { class: 'btn btn-tonal', 'data-focus': 'sheet-create', onclick: () => a.setNewFolder(key, { accepted: true }) }, icon('add'), t('createThisFolder'))
        : h('button', { class: 'btn btn-text', 'data-focus': 'sheet-dont', onclick: () => a.setNewFolder(key, { accepted: false }) }, t('dontCreate')));
  } else if (node.kind === 'existing' && node.folder) {
    const f = node.folder;
    const tileBtn = h('button', { class: 'tile-btn', 'aria-label': t('emojiLabel', node.name), 'data-focus': 'sheet-emoji', disabled: d.folderStyle === 'name', onclick: (e: Event) => openEmojiMenu(e.currentTarget as HTMLElement, node.emoji, node.name, (emoji) => a.setFolderEmoji(f.id, emoji)) },
      d.folderStyle !== 'name' && node.emoji ? node.emoji : icon('folder'));
    head = h('div', { class: 'sheet-head' }, tileBtn, h('div', { class: 'grow' }, h('h2', { id: 'sheet-title' }, node.name)), close);
    sub = [folderPathLabel(an, f), shared].filter(Boolean).join(' · ');
  } else {
    const review = node.kind === 'review';
    head = h('div', { class: 'sheet-head' },
      h('span', { class: 'tile-btn', style: review ? 'background:var(--tertiary-container);color:var(--on-tertiary-container);cursor:default' : 'background:var(--surface-high);color:var(--on-surface-variant);cursor:default' }, icon(review ? 'help' : 'push_pin')),
      h('div', { class: 'grow' }, h('h2', { id: 'sheet-title' }, review ? t('nodeReview') : t('nodeStay'))), close);
    sub = review ? t('reviewHint') : (shared ?? t('staysHint'));
  }
  const rows = node.ids.map((id) => {
    const b = an.snapshot.bookmarks.get(id);
    const title = bookmarkTitle(an, d, id) || t('unnamed');
    const reason = rowReason(an, d, id);
    const why = reason !== shared ? reason : null;
    const li = h('li', {
      class: 'row', draggable: !node.off, 'data-id': id,
      ondragstart: (e: DragEvent) => {
        e.dataTransfer?.setData(DRAG_TYPE, id);
        e.dataTransfer?.setData('text/plain', title);
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
        li.classList.add('dragging');
        // Every folder that can take the bookmark lights up; the one under the pointer lights up more.
        document.querySelector('.board')?.classList.add('drag-active');
        document.querySelector(`.dests .node[data-key="${CSS.escape(node.key)}"]`)?.classList.add('origin');
      },
      ondragend: () => {
        li.classList.remove('dragging');
        clearDropTargets();
      },
    },
      favicon(b?.url ?? '', 20),
      h('div', { class: 'row-text' },
        h('span', { class: 'title' }, title),
        h('span', { class: 'sub' }, host(b?.url ?? '')),
        why ? h('span', { class: 'why', id: `why-${id}` }, why) : null),
      h('button', { class: 'icon-btn', 'aria-label': `${t('moveTo')} : ${title}`, 'aria-describedby': why ? `why-${id}` : undefined, 'aria-haspopup': 'menu', 'data-focus': `mv-${id}`, onclick: (e: Event) => openMoveMenu(e.currentTarget as HTMLElement, an, d, a, id) }, icon('drive_file_move')));
    return li;
  });
  return h('aside', { class: 'sheet', id: 'sheet', 'aria-label': node.kind === 'new' || node.kind === 'existing' ? node.name : node.kind === 'review' ? t('nodeReview') : t('nodeStay') },
    head,
    sub && h('p', { class: 'sheet-sub' }, sub),
    actions,
    rows.length
      ? h('ul', { class: 'sheet-list', 'data-scroll': `sheet-${node.key}`, 'aria-label': t('countLabel', rows.length) }, rows)
      : h('div', { class: 'empty-drop' }, t('emptyFolder')));
}
