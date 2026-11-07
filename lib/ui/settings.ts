import { browser } from 'wxt/browser';
import { t } from '../i18n';
import { MODEL_ID } from '../model';
import type { FolderItem } from '../types';
import { h } from './dom';
import type { Actions, State } from './state';
import { styleSwitch } from './views';

export interface SettingsData {
  folders: FolderItem[];
  otherId?: string;
  barId?: string;
}

function folderName(f: FolderItem, data: SettingsData): string {
  if (f.isRoot) return f.id === data.barId ? t('barFolder') : f.id === data.otherId ? t('otherFolder') : f.title;
  return f.title || t('unnamed');
}

function item(title: string, supporting: string | null, control: HTMLElement | null, forId?: string): HTMLElement {
  const text = h('div', { class: 'grow' }, forId ? h('label', { for: forId }, title) : h('div', null, title), supporting ? h('span', { class: 'supporting' }, supporting) : null);
  return h('li', { class: 'item' }, text, control);
}

export function settingsView(s: State, a: Actions, data: SettingsData): HTMLElement {
  const selected = new Set(s.settings.sourceFolderIds.length ? s.settings.sourceFolderIds : data.otherId ? [data.otherId] : []);
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    a.setSources([...next]);
  };
  const manifest = browser.runtime.getManifest();
  return h('div', { class: 'settings' },
    h('h1', null, t('tabSettings')),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsSources')),
      h('div', { class: 'list' },
        h('p', { class: 'item muted', style: 'min-height:0;padding-bottom:0' }, t('settingsSourcesHint')),
        h('div', { class: 'folder-pick', role: 'group', 'aria-label': t('settingsSources') },
          data.folders.map((f) => h('label', { style: `padding-left:${20 + Math.min(f.depth, 6) * 20}px` },
            h('input', { type: 'checkbox', checked: selected.has(f.id), 'data-focus': `src-${f.id}`, onchange: (e: Event) => toggle(f.id, (e.target as HTMLInputElement).checked) }),
            h('span', { class: 'grow' }, folderName(f, data)), h('span', { class: 'muted small' }, String(f.bookmarkIds.length))))))),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsDefaults')),
      h('ul', { class: 'list' },
        item(t('optFolderStyle'), null, styleSwitch(s.settings.folderStyle, (v) => a.setFolderStyle(v), 'settings-style')),
        item(t('optIconOnly'), t('optIconOnlyHint'), h('input', { type: 'checkbox', role: 'switch', class: 'switch', id: 'set-icons', checked: s.settings.iconOnlyBar, 'data-focus': 'set-icons', onchange: (e: Event) => a.setIconOnlyDefault((e.target as HTMLInputElement).checked) }), 'set-icons'),
        item(t('optHistory'), s.useHistory ? t('settingsHistoryOn') : t('settingsHistoryOff'), h('input', { type: 'checkbox', role: 'switch', class: 'switch', id: 'set-history', checked: s.useHistory, 'data-focus': 'set-history', onchange: (e: Event) => a.setUseHistory((e.target as HTMLInputElement).checked) }), 'set-history'))),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsData')),
      h('ul', { class: 'list' },
        item(t('settingsNames'), t('settingsNamesCount', s.iconOnlyCount), h('button', { class: 'btn btn-outlined', disabled: s.iconOnlyCount === 0, 'data-focus': 'restore-names', onclick: () => a.restoreNames() }, t('restoreNames'))),
        item(t('clearCache'), t('aboutPrivacy'), h('button', { class: 'btn btn-outlined', 'data-focus': 'clear-cache', onclick: () => a.clearCache() }, t('clear'))))),
    h('p', { class: 'status', role: 'status' }, s.status),
    h('section', { class: 'section' },
      h('h2', { class: 'section-title small' }, t('settingsAbout')),
      h('ul', { class: 'list' },
        item(`${manifest.name}`, `${manifest.version_name ?? manifest.version} · ${t('aboutModel', MODEL_ID)}`, null))));
}
