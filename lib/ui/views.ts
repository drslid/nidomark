import { t } from '../i18n';
import { type FolderStyle, isUnresolved } from '../plan';
import { favicon, h, icon } from './dom';
import type { Actions, State } from './state';

export function styleSwitch(current: FolderStyle, onChange: (s: FolderStyle) => void, name = 'folder-style'): HTMLElement {
  const choices: [FolderStyle, string][] = [['emoji-name', t('styleEmojiName')], ['name', t('styleName')], ['emoji', t('styleEmoji')]];
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t('optFolderStyle') },
    choices.map(([value, label]) => h('label', null,
      h('input', { type: 'radio', name, value, checked: value === current, 'data-focus': `${name}-${value}`, onchange: () => onChange(value) }),
      icon('check'), h('span', null, label))));
}

export function favicons(urls: string[], max = 5): HTMLElement {
  return h('span', { class: 'favicons', 'aria-hidden': 'true' }, urls.slice(0, max).map((u) => favicon(u, 18)));
}

export function startView(s: State, a: Actions): HTMLElement {
  const last = s.lastJournal?.status === 'applied' ? s.lastJournal : null;
  const interrupted = isUnresolved(s.lastJournal);
  const p = s.preview;
  const count = p ? (p.count === 0 ? t('startCountNone') : p.count === 1 ? t('startCountOne') : t('startCount', p.count)) : '';
  return h('div', { class: 'center' },
    interrupted && h('div', { class: 'banner banner-warn', role: 'alert' },
      icon('warning'),
      h('div', { class: 'grow' }, h('div', null, t('interruptedTitle')), h('div', { class: 'muted small' }, t('interruptedHint'))),
      h('button', { class: 'btn btn-text', onclick: () => a.keepInterrupted(), 'data-focus': 'interrupted-keep' }, t('interruptedKeep')),
      h('button', { class: 'btn btn-tonal', onclick: () => a.undo(), 'data-focus': 'interrupted-undo' }, t('interruptedUndo'))),
    !interrupted && last && h('div', { class: 'banner', role: 'status' },
      icon('history'),
      h('span', { class: 'grow' }, t('lastRun', new Date(last.createdAt).toLocaleString())),
      h('button', { class: 'btn btn-text', onclick: () => a.undo(), 'data-focus': 'undo' }, t('undoLast'))),
    h('img', { class: 'app-icon', src: '/icon/128.png', alt: '' }),
    h('h1', null, t('startTitle')),
    h('p', { class: 'lead' }, t('startLead')),
    h('div', { class: 'list', style: 'width:100%' },
      p && h('div', { class: 'preview' }, favicons(p.urls), h('div', { class: 'grow' }, h('div', null, count), h('div', { class: 'muted small' }, p.folderName))),
      h('label', { class: 'option-row', style: 'border-top:1px solid var(--surface-high);padding-top:12px;padding-bottom:12px' },
        h('span', { class: 'grow' }, h('span', { style: 'display:block' }, t('optHistory')), h('span', { class: 'muted small', style: 'display:block' }, t('optHistoryHint'))),
        h('input', { type: 'checkbox', role: 'switch', class: 'switch', checked: s.useHistory, 'data-focus': 'opt-history', onchange: (e: Event) => a.setUseHistory((e.target as HTMLInputElement).checked) }),
        h('span', { style: 'width:12px' }))),
    h('button', { class: 'btn btn-filled btn-lg', disabled: interrupted || p?.count === 0, onclick: () => a.analyze(), 'data-focus': 'analyze' }, icon('auto_awesome'), t('analyze')),
    h('p', { class: 'note small' }, icon('shield'), t('privacyNote')));
}

const PHASE_LABEL: Record<string, string> = { reading: 'phaseReading', loading: 'phaseLoading', embedding: 'phaseEmbedding', grouping: 'phaseGrouping', applying: 'applying' };

export function progressView(s: State): HTMLElement {
  const { phase, done, total } = s.progress;
  const known = (phase === 'embedding' || phase === 'applying') && total > 0;
  const pct = known ? Math.round((done / total) * 100) : 0;
  return h('div', { class: 'center', 'aria-busy': 'true' },
    h('img', { class: 'app-icon', src: '/icon/128.png', alt: '' }),
    h('h1', null, t(PHASE_LABEL[phase] as string)),
    h('div', { class: `progress ${known ? '' : 'indeterminate'}`, role: 'progressbar', 'aria-label': t(PHASE_LABEL[phase] as string), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': known ? pct : undefined },
      h('div', { style: `width:${pct}%` })),
    h('p', { class: 'muted' }, known ? t('progressCount', done, total) : t('privacyNote')));
}

export function doneView(s: State, a: Actions): HTMLElement {
  const r = s.result;
  return h('div', { class: 'center', role: 'status' },
    icon(r?.undone ? 'undo' : 'check_circle', undefined, 'done-icon'),
    h('h1', null, r?.undone ? t('undone') : t('doneTitle')),
    !r?.undone && h('p', { class: 'lead' }, t('doneSummary', r?.done ?? 0)),
    r?.undone && (r.skipped ?? 0) > 0 && h('p', { class: 'lead' }, t('undoSkipped', r.skipped)),
    !r?.undone && (r?.skipped ?? 0) > 0 && h('div', { class: 'banner banner-warn' }, icon('warning'), h('span', { class: 'grow' }, t('doneSkipped', r?.skipped ?? 0))),
    h('div', { style: 'display:flex;gap:8px' },
      !r?.undone && h('button', { class: 'btn btn-outlined', onclick: () => a.undo(), 'data-focus': 'undo' }, icon('undo'), t('undoLast')),
      h('button', { class: 'btn btn-filled', onclick: () => a.backToStart(), 'data-focus': 'again' }, t('finish'))));
}

export function messageView(iconName: string, title: string, text: string, actionLabel: string, action: () => void): HTMLElement {
  return h('div', { class: 'center', role: 'alert' },
    icon(iconName, undefined, 'done-icon'),
    h('h1', null, title),
    h('p', { class: 'lead' }, text),
    h('button', { class: 'btn btn-filled', onclick: action, 'data-focus': 'retry' }, t(actionLabel)));
}
