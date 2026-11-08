import { t } from '../i18n';
import { type FolderStyle, isUnresolved } from '../plan';
import { favicon, h, icon } from './dom';
import type { Actions, State } from './state';

/** Material segmented button: one choice among a few, each visible. */
export function segmented<T extends string>(name: string, current: T, choices: [T, string][], onChange: (v: T) => void, label: string): HTMLElement {
  return h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label },
    choices.map(([value, text]) => h('label', null,
      h('input', { type: 'radio', name, value, checked: value === current, 'data-focus': `${name}-${value}`, onchange: () => onChange(value) }),
      icon('check'), h('span', null, text))));
}

export function styleSwitch(current: FolderStyle, onChange: (s: FolderStyle) => void, name = 'folder-style'): HTMLElement {
  return segmented(name, current, [['emoji', t('styleEmoji')], ['emoji-name', t('styleEmojiName')], ['name', t('styleName')]], onChange, t('optFolderStyle'));
}

export function favicons(urls: string[], max = 5): HTMLElement {
  return h('span', { class: 'favicons', 'aria-hidden': 'true' }, urls.slice(0, max).map((u) => favicon(u, 18)));
}

function switchRow(id: string, title: string, hint: string, checked: boolean, onChange: (on: boolean) => void): HTMLElement {
  return h('label', { class: 'option-row', for: id },
    h('span', { class: 'grow' }, h('span', { class: 'row-title' }, title), h('span', { class: 'muted small row-hint' }, hint)),
    h('input', { type: 'checkbox', role: 'switch', class: 'switch', id, checked, 'data-focus': id, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) }));
}

function scopePicker(s: State, a: Actions): HTMLElement | null {
  const p = s.preview;
  if (!p) return null;
  const rows: HTMLElement[] = [];
  const children = (rootId: string) => {
    const i = p.folders.findIndex((f) => f.id === rootId);
    const out: typeof p.folders = [];
    for (let k = i + 1; k < p.folders.length && !(p.folders[k] as { isRoot: boolean }).isRoot; k++) out.push(p.folders[k] as (typeof p.folders)[number]);
    return out;
  };
  for (const f of p.folders) {
    if (!f.isRoot) continue;
    const kids = children(f.id).filter((c) => c.count > 0);
    if (!f.count && !kids.length) continue;
    const open = s.expandedScope.includes(f.id);
    const isBar = f.title === t('barFolder');
    rows.push(h('div', { class: 'scope-row' },
      h('label', { class: 'grow scope-label' },
        h('input', { type: 'checkbox', checked: f.included, 'data-focus': `scope-${f.id}`, onchange: (e: Event) => a.toggleScope(f.id, (e.target as HTMLInputElement).checked) }),
        h('span', { class: 'grow' }, h('span', { class: 'row-title' }, f.title), isBar ? h('span', { class: 'muted small row-hint' }, t('barScopeHint')) : null),
        h('span', { class: 'count' }, f.count.toLocaleString())),
      kids.length
        ? h('button', { class: `icon-btn chevron${open ? ' open' : ''}`, type: 'button', 'aria-expanded': String(open), 'aria-label': t('showSubfolders', f.title), 'data-focus': `expand-${f.id}`, onclick: () => a.toggleExpanded(f.id) }, icon('expand_more'))
        : h('span', { class: 'chevron-space' })));
    if (open) {
      for (const c of kids) {
        rows.push(h('div', { class: 'scope-row child' },
          h('label', { class: 'grow scope-label' },
            h('input', { type: 'checkbox', checked: c.included, 'data-focus': `scope-${c.id}`, onchange: (e: Event) => a.toggleScope(c.id, (e.target as HTMLInputElement).checked) }),
            h('span', { class: 'grow row-title' }, c.title),
            h('span', { class: 'count' }, c.count.toLocaleString())),
          h('span', { class: 'chevron-space' })));
      }
    }
  }
  return h('div', { class: 'list scope', role: 'group', 'aria-label': t('scopeLabel') }, rows);
}

export function startView(s: State, a: Actions): HTMLElement {
  const last = s.lastJournal?.status === 'applied' ? s.lastJournal : null;
  const interrupted = isUnresolved(s.lastJournal);
  const p = s.preview;
  const st = s.settings;
  const count = p?.count ?? 0;
  const more = s.moreOptions;
  const extras = [st.readSites && t('sumReadSites'), st.checkDead && t('sumCheckDead'), st.removeDuplicates && t('sumDupes'), st.backup && t('sumBackup'), s.useHistory && t('sumHistory')].filter(Boolean).join(' · ');
  return h('div', { class: 'center start' },
    interrupted && h('div', { class: 'banner banner-warn', role: 'alert' },
      icon('warning'),
      h('div', { class: 'grow' }, h('div', null, t('interruptedTitle')), h('div', { class: 'muted small' }, t('interruptedHint'))),
      h('button', { class: 'btn btn-text', onclick: () => a.keepInterrupted(), 'data-focus': 'interrupted-keep' }, t('interruptedKeep')),
      h('button', { class: 'btn btn-tonal', onclick: () => a.undo(), 'data-focus': 'interrupted-undo' }, t('interruptedUndo'))),
    !interrupted && last && h('div', { class: 'banner', role: 'status' },
      icon('history'),
      h('span', { class: 'grow' }, t('lastRun', new Date(last.createdAt).toLocaleString())),
      h('button', { class: 'btn btn-text', onclick: () => a.undo(), 'data-focus': 'undo' }, t('undoLast'))),
    h('h1', null, t('startTitle')),
    h('p', { class: 'lead' }, t('startLead')),
    scopePicker(s, a),
    h('div', { class: 'list options' },
      h('div', { class: 'option-row' },
        h('span', { class: 'grow row-title', id: 'dest-label' }, t('destinationLabel')),
        segmented('destination', st.destination, [['bar', t('barFolder')], ['other', t('otherFolder')]], (v) => a.setDestination(v), t('destinationLabel'))),
      h('div', { class: 'option-row' },
        h('span', { class: 'grow row-title' }, t('optFolderStyle')),
        styleSwitch(st.folderStyle, (v) => a.setFolderStyle(v), 'start-style')),
      h('button', { class: 'option-row disclosure', type: 'button', 'aria-expanded': String(more), 'data-focus': 'more-options', onclick: () => a.toggleMoreOptions() },
        h('span', { class: 'grow' }, h('span', { class: 'row-title' }, t('moreOptions')), !more && extras ? h('span', { class: 'muted small row-hint' }, extras) : null),
        icon('expand_more', undefined, `chevron-icon${more ? ' open' : ''}`)),
      more && switchRow('opt-read', t('optReadSites'), t('optReadSitesHint'), st.readSites, (on) => a.setOption('readSites', on)),
      more && switchRow('opt-dead', t('optCheckDead'), t('optCheckDeadHint'), st.checkDead, (on) => a.setOption('checkDead', on)),
      more && switchRow('opt-dupes', t('optDupes'), t('optDupesHint'), st.removeDuplicates, (on) => a.setOption('removeDuplicates', on)),
      more && switchRow('opt-backup', t('optBackup'), t('optBackupHint'), st.backup, (on) => a.setOption('backup', on)),
      more && switchRow('opt-history', t('optHistory'), t('optHistoryHint'), s.useHistory, (on) => a.setUseHistory(on))),
    h('button', { class: 'btn btn-filled btn-lg', disabled: interrupted || count === 0, onclick: () => a.analyze(), 'data-focus': 'analyze' },
      icon('auto_awesome'), count === 0 ? t('startCountNone') : count === 1 ? t('analyzeOne') : t('analyzeCount', count.toLocaleString())),
    h('div', { class: 'privacy' },
      icon('shield', undefined, 'privacy-icon'),
      h('div', null, h('p', { class: 'privacy-title' }, t('privacyTitle')), h('p', { class: 'muted small' }, t('privacyBody')))));
}

const PHASE_LABEL: Record<string, string> = { reading: 'phaseReading', loading: 'phaseLoading', embedding: 'phaseEmbedding', sites: 'phaseSites', pages: 'phasePages', grouping: 'phaseGrouping', applying: 'applying' };

export function progressView(s: State): HTMLElement {
  const { phase, done, total } = s.progress;
  const known = (phase === 'embedding' || phase === 'sites' || phase === 'pages' || phase === 'applying') && total > 0;
  const pct = known ? Math.round((done / total) * 100) : 0;
  return h('div', { class: 'center', 'aria-busy': 'true' },
    h('img', { class: 'app-icon', src: '/icon/128.png', alt: '' }),
    h('h1', null, t(PHASE_LABEL[phase] as string)),
    h('div', { class: `progress ${known ? '' : 'indeterminate'}`, role: 'progressbar', 'aria-label': t(PHASE_LABEL[phase] as string), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': known ? pct : undefined },
      h('div', { style: `width:${pct}%` })),
    h('p', { class: 'muted' }, known ? t('progressCount', done.toLocaleString(), total.toLocaleString()) : t('privacyTitle')),
    phase === 'sites' && h('p', { class: 'muted small' }, t('sitesNote')));
}

export function doneView(s: State, a: Actions): HTMLElement {
  const r = s.result;
  return h('div', { class: 'center', role: 'status' },
    icon(r?.undone ? 'undo' : 'check_circle', undefined, 'done-icon'),
    h('h1', null, r?.undone ? t('undone') : t('doneTitle')),
    !r?.undone && h('p', { class: 'lead' }, t('doneSummary', (r?.done ?? 0).toLocaleString())),
    !r?.undone && s.backups[0] && s.lastJournal && s.backups[0].createdAt === s.lastJournal.createdAt && h('p', { class: 'note small' }, icon('history'), t('doneBackup', s.backups[0].title)),
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
