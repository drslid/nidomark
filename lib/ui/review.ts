import type { Analysis } from '../analyze';
import { isWithin } from '../edit';
import { t } from '../i18n';
import { type Decisions, type Op, buildRebuildPlan, folderTitle } from '../plan';
import { archiveSources } from '../pipeline';
import { openNewFolderDialog } from './dialogs';
import { type Dragged, draggable, draggedIds, dropTarget } from './dnd';
import { favicon, h, icon } from './dom';
import { bookmarkTitle, nodeTitle, ownEmoji, rootTitle } from './shared';
import { sheetView } from './sheet';
import type { Actions, State } from './state';
import { type DestNode, type Layout, barPreview, layout, nodeKeyOf } from './viewmodel';
import { PHASE_LABEL, favicons, styleSwitch } from './views';

/** Every change the sort makes, in order: the new tree first, then the old one moved into the archive. */
export function planFor(an: Analysis, d: Decisions, archiveTitle = ''): Op[] {
  const snap = an.snapshot;
  return buildRebuildPlan(an.proposal, d, {
    barId: snap.barId,
    node: (id) => {
      const b = snap.bookmarks.get(id);
      if (b) return { parentId: b.parentId, title: b.title, url: b.url };
      const f = snap.folders.get(id);
      return f ? { parentId: f.parentId, title: f.title } : undefined;
    },
    archive: { parentId: snap.otherId ?? snap.barId ?? '', title: archiveTitle, sources: archiveSources(snap, an.scopeFolderIds, an.scopeExcluded, (id) => rootTitle(an, id)) },
  });
}

function sourceName(an: Analysis): string {
  const all = [an.snapshot.barId, an.snapshot.otherId, an.snapshot.mobileId].filter(Boolean);
  if (all.every((id) => an.scopeFolderIds.includes(id as string))) return t('sourceAll');
  return an.scopeFolderIds.map((id) => rootTitle(an, id)).join(', ');
}

/** What a folder at the top holds, in a few words: its subfolders, or what it is for. */
function nodeMeta(n: DestNode): string {
  if (n.existing) return [t('existingFolderMeta'), ...n.children.map(nodeTitle)].join(' · ');
  if (n.kind === 'bar') return t('nodeBarMeta');
  if (n.kind === 'review') return n.children.length ? n.children.map(nodeTitle).join(' · ') : t('nodeReviewMeta');
  if (n.kind === 'dupes') return t('nodeDupesMeta');
  if (n.kind === 'removed') return t('nodeRemovedMeta');
  if (n.kind === 'existing') return t('nodeLooseMeta');
  return n.children.map(nodeTitle).join(' · ');
}

/** First bookmarks inside a node, subfolders included, for its favicon preview. */
function firstIds(n: DestNode, max: number): string[] {
  const out = n.ids.slice(0, max);
  for (const c of n.children) {
    if (out.length >= max) break;
    out.push(...firstIds(c, max - out.length));
  }
  return out;
}

function tileOf(n: DestNode, small: boolean): Node | string {
  if (n.kind === 'bar') return icon('bolt');
  if (n.kind === 'dupes') return icon('content_copy');
  if (n.kind === 'removed') return icon('delete');
  if (n.kind === 'existing') return icon('subdirectory_arrow_right');
  if (n.kind === 'review') return ownEmoji(n) || icon('help', undefined, small ? 'icon-sm' : '');
  return n.style !== 'name' && n.emoji ? n.emoji : icon('folder', undefined, small ? 'icon-sm' : '');
}

function canvasView(s: State, a: Actions, an: Analysis, lay: Layout): HTMLElement {
  const barId = an.snapshot.barId;
  // What a node takes: bookmarks anywhere but in duplicates, folders into folders that are not inside them.
  const accepts = (n: DestNode) => (dr: Dragged): boolean => {
    if (dr.kind !== 'folder') return n.kind !== 'dupes' && draggedIds(dr).some((id) => lay.where.get(id) !== n.key);
    return !!n.folder && !isWithin(lay.tree, n.folder, dr.key) && lay.parent.get(nodeKeyOf(dr.key)) !== n.key;
  };
  const dropOn = (n: DestNode) => (dr: Dragged): void => {
    if (dr.kind === 'folder') {
      if (n.folder) a.moveFolder(dr.key, { key: n.folder });
      return;
    }
    const ids = draggedIds(dr);
    if (n.kind === 'removed') a.removeMany(ids);
    else if (n.kind === 'bar') a.moveMany(ids, { kind: 'bar' });
    else if (n.kind === 'existing') a.moveMany(ids, { kind: 'existing', folderId: n.key.slice(2) });
    else if (n.folder) a.moveMany(ids, { kind: 'new', key: n.folder });
  };
  const hot = (key: string, on: boolean) => document.querySelector(`.wires .wire[data-key="${CSS.escape(key)}"]`)?.classList.toggle('hot', on);

  const nodeView = (n: DestNode, open: boolean): HTMLElement => {
    const top = n.level === 1;
    const selected = s.selected === n.key;
    const meta = top ? nodeMeta(n) : '';
    const title = nodeTitle(n);
    const main = h('button', {
      class: 'node-main', type: 'button', 'aria-expanded': String(selected), 'aria-controls': selected ? 'sheet' : undefined, 'data-focus': `node-${n.key}`,
      'aria-label': `${title}, ${t('countLabel', n.count.toLocaleString())}${meta ? `, ${meta}` : ''}`,
      onclick: () => a.select(selected ? null : n.key),
    },
      h('span', { class: 'tile', 'aria-hidden': 'true' }, tileOf(n, !top)),
      h('span', { class: 'text' }, h('span', { class: 'name' }, title), meta ? h('span', { class: 'meta' }, meta) : null),
      top ? favicons(firstIds(n, 3).map((id) => an.snapshot.bookmarks.get(id)?.url ?? ''), 3) : null,
      h('span', { class: 'count', 'aria-hidden': 'true' }, n.count.toLocaleString()));
    const el = h('div', {
      class: `node kind-${n.kind} ${top ? 'node-top' : 'node-sub'}${selected ? ' selected' : ''}${n.user ? ' user' : ''}`, 'data-key': n.key, 'data-count': n.count,
      onmouseenter: top ? () => hot(n.key, true) : undefined,
      onmouseleave: top ? () => hot(n.key, false) : undefined,
      onfocusin: top ? () => hot(n.key, true) : undefined,
      onfocusout: top ? () => hot(n.key, false) : undefined,
    },
      main,
      n.children.length
        ? h('button', { class: `icon-btn node-fold${open ? ' open' : ''}`, type: 'button', 'aria-expanded': String(open), 'aria-label': t(open ? 'foldFolder' : 'unfoldFolder', title), title: t(open ? 'foldFolder' : 'unfoldFolder', title), 'data-focus': `fold-${n.key}`, onclick: () => a.toggleCollapsed(n.key) }, icon('expand_more', undefined, 'icon-sm'))
        : null,
      top ? h('span', { class: 'port', 'aria-hidden': 'true' }) : null);
    if (n.kind !== 'dupes') dropTarget(el, accepts(n), dropOn(n));
    // A folder of an earlier sort stays where it is.
    if (n.folder && !n.existing) draggable(el, () => ({ kind: 'folder', key: n.folder as string }), () => title);
    return el;
  };
  const branch = (n: DestNode): HTMLElement => {
    const open = !s.collapsed.includes(n.key);
    return h('div', { class: 'branch' }, nodeView(n, open), n.children.length && open ? h('div', { class: 'children', role: 'group', 'aria-label': nodeTitle(n) }, n.children.map(branch)) : null);
  };
  // The root folders take bookmarks and folders too: at the start of the bar (quick access), or loose at the top.
  const rootLabel = (rootId: string): HTMLElement => {
    const label = h('div', { class: 'dests-label' }, h('span', null, rootTitle(an, rootId)), h('span', { class: 'drop-hint' }, t('dropAtTop')));
    return dropTarget(label, (dr) => {
      if (dr.kind !== 'folder') return draggedIds(dr).some((id) => lay.where.get(id) !== (rootId === barId ? 'bar' : `e:${rootId}`));
      const f = lay.tree.byKey.get(dr.key);
      return !(f && !f.parentKey && f.rootId === rootId);
    }, (dr) => {
      if (dr.kind === 'folder') a.moveFolder(dr.key, { rootId });
      else a.moveMany(draggedIds(dr), rootId === barId ? { kind: 'bar' } : { kind: 'existing', folderId: rootId });
    });
  };
  const roots = [an.snapshot.barId, an.snapshot.otherId].filter((x): x is string => !!x);
  for (const r of lay.roots) if (!roots.includes(r.rootId)) roots.push(r.rootId);
  const total = an.proposal.candidates.length;
  let activeTop = s.selected;
  for (let i = 0; activeTop && lay.parent.has(activeTop) && i < 64; i++) activeTop = lay.parent.get(activeTop) ?? null;
  return h('div', { class: 'canvas', 'data-active-top': activeTop ?? '' },
    h('div', { class: 'source' },
      h('div', { class: 'node node-source', id: 'source-node' },
        h('span', { class: 'text' }, h('span', { class: 'name' }, sourceName(an)), h('span', { class: 'meta' }, t('sourceMeta', total.toLocaleString()))),
        favicons(an.proposal.candidates.slice(0, 5).map((id) => an.snapshot.bookmarks.get(id)?.url ?? '')),
        h('span', { class: 'port', 'aria-hidden': 'true' }))),
    h('div', { class: 'dests', role: 'group', 'aria-label': t('destinations') },
      roots.flatMap((rootId) => [rootLabel(rootId), ...(lay.roots.find((r) => r.rootId === rootId)?.nodes ?? []).map(branch)]),
      lay.out.length ? [h('div', { class: 'dests-label' }, h('span', null, t('notRecreated'))), ...lay.out.map(branch)] : null,
      h('button', { class: 'add-node', type: 'button', 'data-focus': 'add-folder', onclick: () => openNewFolderDialog(an, lay, null, (name, parent) => a.select(nodeKeyOf(a.createFolder(name, parent)))) },
        h('span', { class: 'tile', 'aria-hidden': 'true' }, icon('add')), h('span', null, t('newFolderOption')))));
}

/** The new bookmarks bar, as the browser will show it: quick access icons, then the folders created there. */
function barStrip(a: Actions, an: Analysis, d: Decisions, lay: Layout): HTMLElement | null {
  const items = barPreview(an, lay);
  if (!items.length) return null;
  return h('div', { class: 'barstrip' },
    h('span', { class: 'label small' }, t('barTitle')),
    h('div', { class: 'items', 'data-scroll': 'bar' }, items.map((it) => {
      if (it.folder) {
        const shown = folderTitle(it.title, it.emoji ?? '', it.style ?? d.folderStyle);
        return h('button', { class: 'chip chip-folder', type: 'button', title: it.title, 'aria-label': `${it.title} · ${t('openFolder')}`, 'data-focus': `bar-${it.id}`, onclick: () => a.select(it.id) }, icon('folder', undefined, 'icon-sm'), h('span', null, shown));
      }
      const on = !!d.iconOnly[it.id];
      const title = bookmarkTitle(an, d, it.id) || it.title;
      return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(on), title: on ? `${title} · ${t('showName')}` : t('iconOnlyHint'), 'aria-label': `${title} · ${t('iconOnly')}`, 'data-focus': `bar-${it.id}`, onclick: () => a.toggleIconOnly(it.id) },
        favicon(it.url ?? '', 16), on ? null : h('span', null, title));
    })),
    h('span', { class: 'hint small' }, t('barHint')));
}

function busyStrip(s: State): HTMLElement | null {
  const b = s.busy;
  if (!b) return null;
  const known = (b.phase === 'sites' || b.phase === 'pages' || b.phase === 'embedding') && b.total > 0;
  const pct = known ? Math.round((b.done / b.total) * 100) : 0;
  return h('div', { class: 'busy-strip', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'grow' }, h('span', { class: 'busy-title' }, t('reanalyzing', b.name)), ' · ', h('span', { class: 'muted' }, t(PHASE_LABEL[b.phase] ?? 'phaseGrouping'), known ? ` · ${t('progressCount', b.done.toLocaleString(), b.total.toLocaleString())}` : '')),
    h('div', { class: `progress ${known ? '' : 'indeterminate'}`, role: 'progressbar', 'aria-label': t('reanalyzing', b.name), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': known ? pct : undefined }, h('div', { style: `width:${pct}%` })));
}

export function reviewView(s: State, a: Actions): HTMLElement {
  const an = s.analysis as Analysis;
  const d = s.decisions as Decisions;
  const lay = layout(an, d);
  const selected = s.selected ? (lay.byKey.get(s.selected) ?? null) : null;
  return h('div', { class: `workspace${selected ? ' with-sheet' : ''}` },
    h('section', { class: 'board', 'aria-label': t('proposal'), 'aria-busy': s.busy ? 'true' : undefined },
      s.changedDuringReview && h('div', { class: 'status-banner', role: 'status' }, icon('warning'), h('span', { class: 'grow' }, t('changedBanner')),
        h('button', { class: 'btn btn-text', style: 'color:inherit', onclick: () => a.analyze(), 'data-focus': 'refresh' }, icon('refresh'), t('refresh'))),
      busyStrip(s),
      barStrip(a, an, d, lay),
      h('div', { class: 'canvas-wrap', 'data-scroll': 'canvas', inert: s.busy ? true : undefined }, canvasView(s, a, an, lay)),
      reviewActionBar(s, a)),
    selected ? sheetView(s, a, an, d, selected, lay) : null);
}

export function reviewActionBar(s: State, a: Actions): HTMLElement {
  const an = s.analysis as Analysis;
  const d = s.decisions as Decisions;
  const count = planFor(an, d).filter((op) => op.type === 'createBookmark').length;
  const syncing = [...an.snapshot.folders.values()].some((f) => f.syncing);
  return h('div', { class: 'actionbar', role: 'region', 'aria-label': t('applyRegion') },
    s.snack && h('div', { class: 'snackbar' },
      h('span', { class: 'grow' }, s.snack.text),
      s.snack.undo ? h('button', { class: 'btn btn-text snack-action', type: 'button', 'data-focus': 'snack-undo', onclick: () => a.undoEdit() }, t('undoEdit')) : null,
      h('button', { class: 'icon-btn snack-close', type: 'button', 'aria-label': t('sheetClose'), title: t('sheetClose'), onclick: () => a.dismissSnack() }, icon('close', undefined, 'icon-sm'))),
    h('p', { class: 'summary' }, icon('info'),
      h('span', null, t('nothingYet'), syncing ? h('span', { class: 'small sync' }, t('footerSync')) : null)),
    h('div', { class: 'actions' },
      s.canUndo ? h('button', { class: 'icon-btn', type: 'button', 'data-focus': 'undo-edit', 'aria-label': t('undoEditHint'), title: t('undoEditHint'), disabled: !!s.busy, onclick: () => a.undoEdit() }, icon('undo')) : null,
      h('button', { class: 'btn btn-text', 'data-focus': 'restore', disabled: !!s.busy, onclick: () => a.restoreProposal() }, t('restoreProposal')),
      h('button', { class: 'btn btn-filled', disabled: count === 0 || s.changedDuringReview || !!s.busy, title: s.changedDuringReview ? t('changedBlocked') : undefined, 'data-focus': 'apply', onclick: () => a.apply() },
        icon('check'), count === 1 ? t('applyOne') : t('applyCount', count.toLocaleString()))));
}

export function reviewToolbar(s: State, a: Actions): HTMLElement {
  return styleSwitch((s.decisions as Decisions).folderStyle, (v) => a.setFolderStyle(v), 'review-style');
}

let observer: ResizeObserver | null = null;
let scrolled: HTMLElement | null = null;

/** Draws the connectors from the source node to every folder at the top; stroke weight follows the number of bookmarks. */
export function drawWires(root: HTMLElement, animate: boolean): void {
  observer?.disconnect();
  const canvas = root.querySelector<HTMLElement>('.canvas');
  const srcPort = root.querySelector<HTMLElement>('#source-node .port');
  if (!canvas || !srcPort) return;
  const paint = (withMotion: boolean) => {
    root.querySelector('.wires')?.remove();
    const c = canvas.getBoundingClientRect();
    const sp = srcPort.getBoundingClientRect();
    if (!sp.width) return;
    // Right to left, the curves leave the source on the other side.
    const dir = getComputedStyle(canvas).direction === 'rtl' ? -1 : 1;
    const x1 = sp.left + sp.width / 2 - c.left;
    const y1 = sp.top + sp.height / 2 - c.top;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', `wires${withMotion ? ' draw' : ''}`);
    svg.setAttribute('aria-hidden', 'true');
    const active = canvas.dataset.activeTop;
    const nodes = [...canvas.querySelectorAll<HTMLElement>('.dests .node-top')];
    nodes.forEach((node, i) => {
      const port = node.querySelector<HTMLElement>(':scope > .port')?.getBoundingClientRect();
      if (!port) return;
      const x2 = port.left + port.width / 2 - c.left;
      const y2 = port.top + port.height / 2 - c.top;
      const dx = Math.max(48, Math.abs(x2 - x1) * 0.55) * dir;
      const count = Number(node.dataset.count ?? 0);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
      const kind = node.classList.contains('kind-review') ? ' review' : node.classList.contains('kind-dupes') || node.classList.contains('kind-removed') ? ' dupes' : '';
      const hot = node.matches(':hover, :focus-within') ? ' hot' : '';
      path.setAttribute('class', `wire${kind}${node.dataset.key === active ? ' active' : ''}${hot}`);
      path.dataset.key = node.dataset.key ?? '';
      // The weight follows the number of bookmarks; what is not recreated stays a thin dotted line.
      path.setAttribute('stroke-width', kind === ' dupes' ? '1.5' : String(1.5 + Math.min(count, 12) * 0.5));
      svg.append(path);
      if (withMotion) path.style.setProperty('--delay', `${i * 40}ms`);
    });
    canvas.prepend(svg);
    // The length is only known once the path is in the document.
    if (withMotion) svg.querySelectorAll<SVGPathElement>('path').forEach((p) => p.style.setProperty('--len', String(Math.ceil(p.getTotalLength()))));
  };
  paint(animate);
  observer = new ResizeObserver(() => paint(false));
  observer.observe(canvas);
  // The source node is sticky: redraw the connectors as the canvas scrolls.
  const wrap = root.querySelector<HTMLElement>('.canvas-wrap');
  if (wrap && wrap !== scrolled) {
    scrolled = wrap;
    let queued = false;
    wrap.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        if (wrap.isConnected) paint(false);
      });
    }, { passive: true });
  }
}
