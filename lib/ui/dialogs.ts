import type { Analysis } from '../analyze';
import { t } from '../i18n';
import type { FolderParent } from '../plan';
import { h } from './dom';
import { nodeTitle, rootTitle } from './shared';
import { type Layout, flatten } from './viewmodel';

function dialogShell(labelledBy: string, describedBy?: string): HTMLDialogElement {
  const dialog = h('dialog', { class: 'dialog', 'aria-labelledby': labelledBy, 'aria-describedby': describedBy });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  return dialog;
}

/** A new folder: its name and where it goes, at the top of a root folder or inside a folder of the new tree. */
export function openNewFolderDialog(an: Analysis, lay: Layout, initial: FolderParent | null, onCreate: (name: string, parent: FolderParent) => void): void {
  const input = h('input', { type: 'text', id: 'new-folder-name', maxlength: 60, autocomplete: 'off', placeholder: t('folderName'), required: true });
  const options: HTMLOptionElement[] = [];
  const roots = [an.snapshot.barId, an.snapshot.otherId].filter((x): x is string => !!x);
  const destination = (an.destination === 'bar' ? an.snapshot.barId : an.snapshot.otherId) ?? roots[0] ?? '';
  const chosen = initial ? ('key' in initial ? `key:${initial.key}` : `root:${initial.rootId}`) : `root:${destination}`;
  for (const rootId of roots) {
    options.push(h('option', { value: `root:${rootId}`, selected: chosen === `root:${rootId}` }, t('atTopOf', rootTitle(an, rootId))));
    for (const n of flatten(lay.roots.find((r) => r.rootId === rootId)?.nodes ?? [])) {
      if (!n.folder) continue;
      // Options cannot be styled: em spaces show the depth.
      options.push(h('option', { value: `key:${n.folder}`, selected: chosen === `key:${n.folder}` }, `${'\u2003'.repeat(n.level)}${n.emoji ? `${n.emoji} ` : ''}${nodeTitle(n)}`));
    }
  }
  const select = h('select', { id: 'new-folder-place' }, options);
  const dialog = dialogShell('new-folder-title');
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'new-folder-title' }, t('dialogNewFolderTitle')),
    h('div', { class: 'field' }, h('label', { for: 'new-folder-name', class: 'visually-hidden' }, t('folderName')), input),
    h('div', { class: 'field' }, h('label', { for: 'new-folder-place', class: 'field-label' }, t('folderPlace')), select),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-text', onclick: () => dialog.close() }, t('cancel')),
      h('button', { type: 'submit', class: 'btn btn-filled' }, t('create'))));
  form.addEventListener('submit', () => {
    const name = input.value.trim();
    const v = select.value;
    if (name) onCreate(name, v.startsWith('key:') ? { key: v.slice(4) } : { rootId: v.slice(5) });
  });
  dialog.append(form);
  dialog.showModal();
  input.focus();
}

/** Removing a folder: what it holds goes up to the folder above (the default), or is not recreated either. */
export function openDeleteFolderDialog(name: string, bookmarks: number, folders: number, into: string, onDelete: (withContent: boolean) => void): void {
  const dialog = dialogShell('delete-title', 'delete-body');
  const choice = (value: string, title: string, hint: string, checked: boolean) =>
    h('label', { class: 'choice' },
      h('input', { type: 'radio', name: 'delete-content', value, checked }),
      h('span', null, h('span', { class: 'row-title' }, title), h('span', { class: 'muted small row-hint' }, hint)));
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'delete-title' }, t('deleteFolderTitle', name)),
    h('p', { id: 'delete-body', class: 'muted' }, folders ? t('deleteFolderBodySub', bookmarks.toLocaleString(), folders.toLocaleString()) : t('deleteFolderBody', bookmarks.toLocaleString())),
    h('div', { class: 'choices', role: 'radiogroup', 'aria-labelledby': 'delete-title' },
      choice('keep', t('deleteKeepContent'), t('deleteKeepHint', into), true),
      choice('all', t('deleteWithContent'), t('deleteWithContentHint'), false)),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-text', onclick: () => dialog.close() }, t('cancel')),
      h('button', { type: 'submit', class: 'btn btn-filled' }, t('deleteFolder'))));
  form.addEventListener('submit', () => onDelete((form.querySelector('input[name="delete-content"]:checked') as HTMLInputElement | null)?.value === 'all'));
  dialog.append(form);
  dialog.showModal();
  (form.querySelector('.btn-text') as HTMLElement | null)?.focus();
}

/** Asks before an action that cannot be undone. */
export function openConfirmDialog(title: string, body: string, confirmLabel: string, onConfirm: () => void): void {
  const dialog = dialogShell('confirm-title', 'confirm-body');
  const form = h('form', { method: 'dialog' },
    h('h2', { id: 'confirm-title' }, title),
    h('p', { id: 'confirm-body', class: 'muted' }, body),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-text', onclick: () => dialog.close() }, t('cancel')),
      h('button', { type: 'submit', class: 'btn btn-filled' }, confirmLabel)));
  form.addEventListener('submit', () => onConfirm());
  dialog.append(form);
  dialog.showModal();
  (form.querySelector('.btn-text') as HTMLElement | null)?.focus();
}
