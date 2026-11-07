import type { Analysis } from '../analyze';
import { t } from '../i18n';
import { type Decisions, buildPlan, folderTitle } from '../plan';
import { stripEmoji } from '../vocab';
import { favicon, h, icon } from './dom';
import { DRAG_TYPE, bookmarkTitle, clearDropTargets, folderPathLabel, openNewFolderDialog, sheetView } from './sheet';
import type { Actions, State } from './state';
import { type DestNode, barItems, candidateIds, destinations, keyToTarget } from './viewmodel';
import { favicons, styleSwitch } from './views';

export function planFor(an: Analysis, d: Decisions) {
  return buildPlan(an.proposal, d, {
    node: (id) => {
      const b = an.snapshot.bookmarks.get(id);
      if (b) return { parentId: b.parentId, title: b.title, url: b.url };
      const f = an.snapshot.folders.get(id);
      return f ? { parentId: f.parentId, title: f.title } : undefined;
    },
  });
}

function sourceName(an: Analysis): string {
  return an.sourceFolderIds.map((id) => (id === an.snapshot.otherId ? t('otherFolder') : (an.snapshot.folders.get(id)?.title ?? ''))).join(', ');
}

function nodeTitle(n: DestNode): string {
  return n.kind === 'review' ? t('nodeReview') : n.kind === 'stay' ? t('nodeStay') : n.name;
}

function nodeView(s: State, a: Actions, an: Analysis, d: Decisions, n: DestNode): HTMLElement {
  const tile = n.kind === 'review' ? icon('help') : n.kind === 'stay' ? icon('push_pin') : d.folderStyle !== 'name' && n.emoji ? n.emoji : icon('folder');
  const meta = n.kind === 'new' ? (n.off ? t('nodeOff') : t('otherFolder')) : n.kind === 'existing' && n.folder ? folderPathLabel(an, n.folder) : n.kind === 'review' ? t('nodeReviewMeta') : t('nodeStayMeta');
  const droppable = !n.off && n.kind !== 'review';
  const hot = (on: boolean) => document.querySelector(`.wires .wire[data-key="${CSS.escape(n.key)}"]`)?.classList.toggle('hot', on);
  const el = h('button', {
    class: `node kind-${n.kind}${n.off ? ' off' : ''}${droppable ? ' droppable' : ''}`, type: 'button', 'data-key': n.key, 'data-count': n.ids.length, 'data-focus': `node-${n.key}`,
    'aria-expanded': String(s.selected === n.key), 'aria-controls': s.selected === n.key ? 'sheet' : undefined,
    'aria-label': `${nodeTitle(n)}, ${t('countLabel', n.ids.length)}${n.kind === 'new' && !n.off ? `, ${t('newBadge')}` : ''}`,
    onclick: () => a.select(s.selected === n.key ? null : n.key),
    onmouseenter: () => hot(true),
    onmouseleave: () => hot(el.matches(':focus-visible')),
    onfocus: () => hot(el.matches(':focus-visible')),
    onblur: () => hot(false),
    ondragover: (e: DragEvent) => {
      if (!droppable || !e.dataTransfer?.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drop-target');
    },
    ondragleave: () => el.classList.remove('drop-target'),
    ondrop: (e: DragEvent) => {
      const id = e.dataTransfer?.getData(DRAG_TYPE);
      clearDropTargets();
      if (!droppable || !id) return;
      e.preventDefault();
      a.move(id, keyToTarget(n.key));
    },
  },
    h('span', { class: 'tile', 'aria-hidden': 'true' }, tile),
    h('span', { class: 'text' },
      h('span', { class: 'name' }, h('span', null, nodeTitle(n)), n.kind === 'new' && !n.off ? h('span', { class: 'tag' }, t('newBadge')) : null),
      h('span', { class: 'meta' }, meta)),
    favicons(n.ids.map((id) => an.snapshot.bookmarks.get(id)?.url ?? ''), 3),
    h('span', { class: 'count', 'aria-hidden': 'true' }, String(n.ids.length)),
    h('span', { class: 'port', 'aria-hidden': 'true' }));
  return el;
}

function barStrip(a: Actions, an: Analysis, d: Decisions): HTMLElement | null {
  const items = barItems(an);
  if (!items.length) return null;
  return h('div', { class: 'barstrip' },
    h('span', { class: 'label small' }, t('barTitle')),
    h('div', { class: 'items', 'data-scroll': 'bar' }, items.map((it) => {
      if (it.folder) {
        const f = an.snapshot.folders.get(it.id);
        const fe = d.folderEmojis[it.id];
        const shown = f && fe?.accepted && d.folderStyle !== 'name' ? folderTitle(stripEmoji(f.title), fe.emoji, d.folderStyle) : it.title;
        return h('span', { class: 'chip chip-folder', title: shown }, icon('folder', undefined, 'icon-sm'), h('span', null, shown));
      }
      const on = !!d.iconOnly[it.id];
      const title = bookmarkTitle(an, d, it.id) || it.title;
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), title: on ? `${title} · ${t('showName')}` : t('iconOnlyHint'), 'aria-label': `${title} · ${t('iconOnly')}`, 'data-focus': `bar-${it.id}`, onclick: () => a.toggleIconOnly(it.id) },
        favicon(it.url ?? '', 16), on ? null : h('span', null, title));
    })),
    h('span', { class: 'hint small' }, t('barHint')));
}

export function reviewView(s: State, a: Actions): HTMLElement {
  const an = s.analysis as Analysis;
  const d = s.decisions as Decisions;
  const nodes = destinations(an, d);
  const ids = candidateIds(an);
  const selected = nodes.find((n) => n.key === s.selected) ?? null;
  const canvas = h('div', { class: 'canvas' },
    h('div', { class: 'source' },
      h('div', { class: 'node', id: 'source-node' },
        h('span', { class: 'text' }, h('span', { class: 'name' }, h('span', null, sourceName(an))), h('span', { class: 'meta' }, t('sourceMeta', ids.length))),
        favicons(ids.slice(0, 5).map((id) => an.snapshot.bookmarks.get(id)?.url ?? '')),
        h('span', { class: 'port', 'aria-hidden': 'true' }))),
    h('div', { class: 'dests', role: 'group', 'aria-label': t('destinations') },
      nodes.map((n) => nodeView(s, a, an, d, n)),
      h('button', { class: 'add-node', type: 'button', 'data-focus': 'add-folder', onclick: () => openNewFolderDialog((name) => a.select(a.createFolder(name))) },
        h('span', { class: 'tile', 'aria-hidden': 'true' }, icon('add')), h('span', null, t('newFolderOption')))));
  return h('div', { class: `workspace${selected ? ' with-sheet' : ''}` },
    h('section', { class: 'board', 'aria-label': t('proposal') },
      s.changedDuringReview && h('div', { class: 'status-banner', role: 'status' }, icon('warning'), h('span', { class: 'grow' }, t('changedBanner')),
        h('button', { class: 'btn btn-text', style: 'color:inherit', onclick: () => a.analyze(), 'data-focus': 'refresh' }, icon('refresh'), t('refresh'))),
      barStrip(a, an, d),
      h('div', { class: 'canvas-wrap', 'data-scroll': 'canvas' }, canvas),
      reviewActionBar(s, a)),
    selected ? sheetView(a, an, d, selected) : null);
}

export function reviewActionBar(s: State, a: Actions): HTMLElement {
  const an = s.analysis as Analysis;
  const d = s.decisions as Decisions;
  const count = planFor(an, d).length;
  const syncing = [...an.snapshot.folders.values()].some((f) => f.syncing);
  return h('div', { class: 'actionbar', role: 'region', 'aria-label': t('applyRegion') },
    h('p', { class: 'summary' }, icon('info'),
      h('span', null, t('nothingYet'), syncing ? h('span', { class: 'small sync' }, t('footerSync')) : null)),
    h('div', { class: 'actions' },
      count > 0
        ? h('button', { class: 'btn btn-text', 'data-focus': 'reject-all', onclick: () => a.rejectAll() }, t('rejectAll'))
        : h('button', { class: 'btn btn-text', 'data-focus': 'restore', onclick: () => a.restoreProposal() }, t('restoreProposal')),
      h('button', { class: 'btn btn-filled', disabled: count === 0 || s.changedDuringReview, title: s.changedDuringReview ? t('changedBlocked') : undefined, 'data-focus': 'apply', onclick: () => a.apply() },
        icon('check'), count === 0 ? t('applyShort') : count === 1 ? t('applyOne') : t('applyCount', count))));
}

export function reviewToolbar(s: State, a: Actions): HTMLElement {
  return styleSwitch((s.decisions as Decisions).folderStyle, (v) => a.setFolderStyle(v), 'review-style');
}

let observer: ResizeObserver | null = null;

/** Draws the connectors from the source node to every destination node; stroke weight follows the number of bookmarks. */
export function drawWires(root: HTMLElement, s: State, animate: boolean): void {
  observer?.disconnect();
  const canvas = root.querySelector<HTMLElement>('.canvas');
  const srcPort = root.querySelector<HTMLElement>('#source-node .port');
  if (!canvas || !srcPort) return;
  const paint = (withMotion: boolean) => {
    root.querySelector('.wires')?.remove();
    const c = canvas.getBoundingClientRect();
    const sp = srcPort.getBoundingClientRect();
    if (!sp.width) return;
    const x1 = sp.left + sp.width / 2 - c.left;
    const y1 = sp.top + sp.height / 2 - c.top;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `wires${withMotion ? ' draw' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const nodes = [...canvas.querySelectorAll<HTMLElement>('.dests .node')];
    nodes.forEach((node, i) => {
      if (node.classList.contains('off')) return;
      const port = node.querySelector<HTMLElement>('.port')?.getBoundingClientRect();
      if (!port) return;
      const x2 = port.left + port.width / 2 - c.left;
      const y2 = port.top + port.height / 2 - c.top;
      const dx = Math.max(48, (x2 - x1) * 0.55);
      const count = Number(node.dataset.count ?? 0);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      const kind = node.classList.contains('kind-review') ? ' review' : node.classList.contains('kind-stay') ? ' stay' : '';
      const hot = node.matches(':hover, :focus-visible') ? ' hot' : '';
      path.setAttribute('class', `wire${kind}${node.dataset.key === s.selected ? ' active' : ''}${hot}`);
      path.dataset.key = node.dataset.key ?? '';
      // Bookmarks that move get a weight that follows their number; "stays in place" stays a thin dashed line.
      path.setAttribute('stroke-width', kind === ' stay' ? '1.5' : String(1.5 + Math.min(count, 12) * 0.5));
      svg.append(path);
      if (withMotion) {
        path.style.setProperty('--len', String(Math.ceil(path.getTotalLength?.() ?? 600)));
        path.style.setProperty('--delay', `${i * 40}ms`);
      }
    });
    canvas.prepend(svg);
    // The length is only known once the path is in the document.
    if (withMotion) svg.querySelectorAll<SVGPathElement>('path').forEach((p) => p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))));
  };
  paint(animate);
  observer = new ResizeObserver(() => paint(false));
  observer.observe(canvas);
}
