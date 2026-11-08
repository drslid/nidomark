import { browser } from 'wxt/browser';
import { t } from '../i18n';
import { MODEL_ID } from '../model';
import type { FolderItem } from '../types';
import { h } from './dom';
import type { Actions, State } from './state';
import { openConfirmDialog } from './sheet';
import { segmented, styleSwitch } from './views';

export interface SettingsData {
  folders: FolderItem[];
  otherId?: string;
  barId?: string;
}

function item(title: string, supporting: string | null, control: HTMLElement | null, forId?: string): HTMLElement {
  const text = h('div', { class: 'grow' }, forId ? h('label', { for: forId }, title) : h('div', null, title), supporting ? h('span', { class: 'supporting' }, supporting) : null);
  return h('li', { class: 'item' }, text, control);
}

function toggle(id: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  return h('input', { type: 'checkbox', role: 'switch', class: 'switch', id, checked, 'data-focus': id, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) });
}

export function settingsView(s: State, a: Actions, _data: SettingsData): HTMLElement {
  const st = s.settings;
  const manifest = browser.runtime.getManifest();
  return h('div', { class: 'settings' },
    h('h1', null, t('tabSettings')),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsDefaults')),
      h('ul', { class: 'list' },
        item(t('destinationLabel'), null, segmented('settings-destination', st.destination, [['bar', t('barFolder')], ['other', t('otherFolder')]], (v) => a.setDestination(v), t('destinationLabel'))),
        item(t('optFolderStyle'), t('optFolderStyleHint'), styleSwitch(st.folderStyle, (v) => a.setFolderStyle(v), 'settings-style')),
        item(t('optIconOnly'), t('optIconOnlyHint'), toggle('set-icons', st.iconOnlyBar, (on) => a.setIconOnlyDefault(on)), 'set-icons'),
        item(t('optReadSites'), s.sitesAllowed ? t('sitesAllowed') : t('sitesAsked'), toggle('set-read', st.readSites, (on) => a.setOption('readSites', on)), 'set-read'),
        item(t('optCheckDead'), t('optCheckDeadHint'), toggle('set-dead', st.checkDead, (on) => a.setOption('checkDead', on)), 'set-dead'),
        item(t('optDupes'), t('optDupesHint'), toggle('set-dupes', st.removeDuplicates, (on) => a.setOption('removeDuplicates', on)), 'set-dupes'),
        item(t('optBackup'), t('optBackupHint'), toggle('set-backup', st.backup, (on) => a.setOption('backup', on)), 'set-backup'),
        item(t('optHistory'), s.useHistory ? t('settingsHistoryOn') : t('settingsHistoryOff'), toggle('set-history', s.useHistory, (on) => a.setUseHistory(on)), 'set-history'))),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('backupsTitle')),
      h('ul', { class: 'list' },
        s.backups.length
          ? s.backups.map((b) => item(b.title, b.count !== undefined ? t('backupCount', b.count.toLocaleString()) : null,
            h('button', { class: 'btn btn-outlined', 'data-focus': `del-${b.id}`, onclick: () => openConfirmDialog(t('backupDeleteTitle'), t('backupConfirm', b.title), t('backupDelete'), () => a.deleteBackup(b.id)) }, t('backupDelete'))))
          : item(t('backupsNone'), t('optBackupHint'), null))),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsData')),
      h('ul', { class: 'list' },
        item(t('settingsNames'), t('settingsNamesCount', s.iconOnlyCount), h('button', { class: 'btn btn-outlined', disabled: s.iconOnlyCount === 0, 'data-focus': 'restore-names', onclick: () => a.restoreNames() }, t('restoreNames'))),
        item(t('clearCache'), t('clearCacheHint'), h('button', { class: 'btn btn-outlined', 'data-focus': 'clear-cache', onclick: () => a.clearCache() }, t('clear'))))),
    h('p', { class: 'status', role: 'status' }, s.status),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsAbout')),
      h('ul', { class: 'list' },
        item(t('privacyTitle'), t('privacyBody'), null),
        item(`${manifest.name}`, `${manifest.version_name ?? manifest.version} · ${t('aboutModel', MODEL_ID)}`, null))));
}
