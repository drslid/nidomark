import type { Analysis } from '../analyze';
import { REVIEW_KEY } from '../categorize';
import { t } from '../i18n';
import type { Decisions } from '../plan';
import type { Placement, Reason, Target } from '../types';
import { VOCAB } from '../vocab';
import { closeMenus, favicon, h, icon, openMenu } from './dom';
import type { Actions } from './state';
import { type DestNode, type Layout, type Section, targetKey } from './viewmodel';

/** Drag-and-drop payload type for a bookmark id. */
export const DRAG_TYPE = 'application/x-nidomark-bookmark';

export function reasonText(r: Reason): string {
  return t(r.key, ...(r.subs ?? []));
}

/** Title shown for a bookmark: the accepted cleaner title (or its name, for an icon), or the current one. */
export function bookmarkTitle(an: Analysis, d: Decisions, id: string): string {
  const tt = d.titles[id];
  return tt?.accepted ? tt.title : (an.snapshot.bookmarks.get(id)?.title ?? '');
}

/** "Tech › Development" for a proposed folder. */
export function folderPath(an: Analysis, d: Decisions, key: string): string {
  const byKey = new Map(an.proposal.newFolders.map((f) => [f.key, f]));
  const names: string[] = [];
  for (let k: string | undefined = key; k && names.length < 8; k = byKey.get(k)?.parentKey) names.unshift(d.newFolders[k]?.name ?? byKey.get(k)?.name ?? '');
  return names.join(' › ');
}

/** Root folder a proposed folder is created in. */
function rootName(an: Analysis, rootId: string | undefined): string {
  return rootId === an.snapshot.barId ? t('barFolder') : rootId === an.snapshot.otherId ? t('otherFolder') : (an.snapshot.folders.get(rootId ?? '')?.title ?? '');
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

/** Asks before an action that cannot be undone. */
export function openConfirmDialog(title: string, body: string, confirmLabel: string, onConfirm: () => void): void {
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-body' });
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'confirm-title' }, title),
    h('p', { id: 'confirm-body', class: 'muted' }, body),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-text', onclick: () => dialog.close() }, t('cancel')),
      h('button', { type: 'submit', class: 'btn btn-filled' }, confirmLabel)));
  form.addEventListener('submit', () => onConfirm());
  dialog.append(form);
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  (form.querySelector('.btn-text') as HTMLElement | null)?.focus();
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

function openMoveMenu(anchor: HTMLElement, an: Analysis, d: Decisions, a: Actions, lay: Layout, id: string): void {
  const now = lay.where.get(id);
  const go = (target: Target) => {
    a.move(id, target);
    closeMenus();
  };
  const item = (lead: Node | string, label: string, target: Target, current: boolean, level = 1) =>
    h('button', { type: 'button', role: 'menuitem', class: `indent-${level}`, 'aria-current': current ? 'true' : undefined, onclick: () => go(target) },
      typeof lead === 'string' ? h('span', { class: 'emoji', 'aria-hidden': 'true' }, lead) : lead, h('span', null, label));
  const items: HTMLElement[] = [h('div', { class: 'menu-label' }, t('moveTo'))];
  // The model's lean comes first for a bookmark it could not place for sure.
  const guess = an.proposal.guesses[id];
  if (guess && now?.folder !== guess) items.push(item(icon('auto_awesome'), t('suggestion', folderPath(an, d, guess)), { kind: 'new', key: guess }, false), h('hr'));
  items.push(item(icon('bolt'), t('nodeBar'), { kind: 'bar' }, now?.node === 'bar'));
  for (const n of lay.nodes) {
    if (n.kind === 'bar' || n.kind === 'dupes') continue;
    const key = n.kind === 'review' ? REVIEW_KEY : n.key.slice(2);
    items.push(item(n.kind === 'review' ? icon('help') : n.emoji || icon('folder'), n.kind === 'review' ? t('nodeReview') : n.name, { kind: 'new', key }, now?.folder === key));
    for (const sec of n.sections) items.push(item(sec.emoji || icon('folder'), sec.name, { kind: 'new', key: sec.key }, now?.folder === sec.key, sec.level));
  }
  items.push(h('hr'), h('button', { type: 'button', role: 'menuitem', onclick: () => { closeMenus(); openNewFolderDialog((name) => a.move(id, { kind: 'new', key: a.createFolder(name).slice(2) })); } }, icon('create_new_folder'), t('newFolderOption')));
  const tt = d.titles[id];
  if (tt) items.push(h('hr'), h('button', { type: 'button', role: 'menuitem', onclick: () => { a.toggleTitle(id); closeMenus(); } }, icon('restart_alt'), tt.accepted ? t('keepTitle') : t('useNewTitle')));
  openMenu(anchor, items, t('moveTo'));
}

function host(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return url;
  }
}

export function clearDropTargets(): void {
  document.querySelectorAll('.drop-target, .origin').forEach((el) => el.classList.remove('drop-target', 'origin'));
  document.querySelector('.board')?.classList.remove('drag-active');
}

export function sheetView(a: Actions, an: Analysis, d: Decisions, node: DestNode, lay: Layout): HTMLElement {
  const placements = new Map<string, Placement>(an.proposal.placements.map((p) => [p.bookmarkId, p]));
  /** Why a bookmark is where it is: the proposal's reason, or the user's own choice. */
  const reasonOf = (id: string): string => {
    const pl = placements.get(id);
    const m = d.moves[id];
    if (pl && (!m || targetKey(m.target) === targetKey(pl.target))) return reasonText(pl.reason);
    return t('reasonUser');
  };
  // A reason most bookmarks share is said once, under the title; the others are said on their row.
  const counts = new Map<string, number>();
  if (node.kind !== 'review') for (const id of node.ids) counts.set(reasonOf(id), (counts.get(reasonOf(id)) ?? 0) + 1);
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
  const shared = top && top[1] >= Math.max(2, node.ids.length / 2) ? top[0] : null;

  const close = h('button', { class: 'icon-btn', 'aria-label': t('sheetClose'), 'data-focus': 'sheet-close', onclick: () => a.select(null) }, icon('close'));
  const staticHead = (iconName: string, title: string, extra = '') =>
    h('div', { class: 'sheet-head' }, h('span', { class: `tile-btn tile-static ${extra}`.trim() }, icon(iconName)), h('div', { class: 'grow' }, h('h2', { id: 'sheet-title' }, title)), close);
  let head: HTMLElement;
  let sub: string | null;
  let actions: HTMLElement | null = null;
  if (node.kind === 'new') {
    const key = node.key.slice(2);
    head = h('div', { class: 'sheet-head' },
      h('button', { class: 'tile-btn', 'aria-label': t('emojiLabel', node.name), 'data-focus': 'sheet-emoji', onclick: (e: Event) => openEmojiMenu(e.currentTarget as HTMLElement, node.emoji, node.name, (emoji) => a.setNewFolder(key, { emoji })) }, node.emoji || icon('folder')),
      h('div', { class: 'grow' }, h('input', { class: 'name-field', type: 'text', value: node.name, 'aria-label': t('folderName'), 'data-focus': 'sheet-name', maxlength: 60, onchange: (e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) a.setNewFolder(key, { name: v }); } })),
      close);
    sub = [t('nodeNewIn', rootName(an, node.rootId)), shared].filter(Boolean).join(' · ');
  } else if (node.kind === 'bar') {
    head = staticHead('bolt', t('nodeBar'), 'tile-quick');
    sub = t('barSheetHint');
  } else if (node.kind === 'dupes') {
    head = staticHead('content_copy', t('nodeDupes'));
    sub = t('dupesHint');
    actions = h('div', { class: 'sheet-actions' },
      h('span', { class: 'muted' }, t('countLabel', node.ids.length)),
      h('button', { class: 'btn btn-text', 'data-focus': 'sheet-keep-dupes', onclick: () => a.keepAllDuplicates() }, t('keepAllDupes')));
  } else {
    head = staticHead('help', t('nodeReview'), 'tile-review');
    // Say "tested" only when the pages were actually read.
    const untested = node.ids.every((id) => placements.get(id)?.reason.key === 'reviewNoAccess');
    sub = untested ? t('reviewHintUntested') : t('reviewHint');
  }
  // Bookmarks to check and dead sites can be opened, to see for oneself.
  const openable = node.kind === 'review' || node.key === 'n:c:dead';
  const row = (id: string): HTMLElement => {
    const b = an.snapshot.bookmarks.get(id);
    const title = bookmarkTitle(an, d, id) || t('unnamed');
    const reason = reasonOf(id);
    const why = reason !== shared ? reason : null;
    const guess = node.kind === 'review' ? an.proposal.guesses[id] : undefined;
    const li = h('li', {
      class: 'row', draggable: 'true', 'data-id': id,
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
        why ? h('span', { class: 'why', id: `why-${id}` }, why) : null,
        guess ? h('button', { class: 'suggest', type: 'button', title: t('suggestion', folderPath(an, d, guess)), 'data-focus': `guess-${id}`, onclick: () => a.move(id, { kind: 'new', key: guess }) }, icon('auto_awesome', undefined, 'icon-sm'), h('span', null, t('suggestion', folderPath(an, d, guess)))) : null),
      h('span', { class: 'row-actions' },
        openable && b?.url ? h('a', { class: 'icon-btn', href: b.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': t('openSite', title), title: t('openSite', title), 'data-focus': `open-${id}` }, icon('open_in_new')) : null,
        h('button', { class: 'icon-btn', 'aria-label': `${t('moveTo')} : ${title}`, 'aria-describedby': why ? `why-${id}` : undefined, 'aria-haspopup': 'menu', 'data-focus': `mv-${id}`, onclick: (e: Event) => openMoveMenu(e.currentTarget as HTMLElement, an, d, a, lay, id) }, icon('drive_file_move'))));
    return li;
  };
  const rows = (ids: string[], label: string) => (ids.length ? h('ul', { class: 'rows', 'aria-label': label }, ids.map(row)) : null);
  const section = (sec: Section): HTMLElement =>
    h('section', { class: `sec level-${sec.level}${sec.off ? ' off' : ''}`, 'aria-label': sec.name },
      h('div', { class: 'sec-head' },
        h('button', { class: 'tile-btn tile-sm', 'aria-label': t('emojiLabel', sec.name), 'data-focus': `sec-emoji-${sec.key}`, disabled: sec.off, onclick: (e: Event) => openEmojiMenu(e.currentTarget as HTMLElement, sec.emoji, sec.name, (emoji) => a.setNewFolder(sec.key, { emoji })) }, sec.emoji || icon('folder', undefined, 'icon-sm')),
        h('input', { class: 'name-field name-sm', type: 'text', value: sec.name, 'aria-label': t('folderName'), 'data-focus': `sec-name-${sec.key}`, maxlength: 60, disabled: sec.off, onchange: (e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (v) a.setNewFolder(sec.key, { name: v }); } }),
        h('span', { class: 'count' }, String(sec.ids.length)),
        sec.off
          ? h('button', { class: 'btn btn-text btn-sm', 'data-focus': `sec-create-${sec.key}`, onclick: () => a.setNewFolder(sec.key, { accepted: true }) }, t('createThisFolder'))
          : h('button', { class: 'btn btn-text btn-sm', 'data-focus': `sec-dont-${sec.key}`, onclick: () => a.setNewFolder(sec.key, { accepted: false }) }, t('dontCreate'))),
      sec.off && sec.into ? h('p', { class: 'sec-note small' }, t('sectionOff', sec.into)) : null,
      rows(sec.ids, sec.name));
  const empty = !node.ids.length && !node.sections.length;
  const label = node.kind === 'new' ? node.name : node.kind === 'bar' ? t('nodeBar') : node.kind === 'review' ? t('nodeReview') : t('nodeDupes');
  return h('aside', { class: 'sheet', id: 'sheet', 'aria-label': label },
    head,
    sub && h('p', { class: 'sheet-sub' }, sub),
    actions,
    empty
      ? h('div', { class: 'empty-drop' }, t('emptyFolder'))
      : h('div', { class: 'sheet-list', 'data-scroll': `sheet-${node.key}` }, rows(node.ids, label), node.sections.map(section)));
}
