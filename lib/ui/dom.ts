import { browser } from 'wxt/browser';
import { ICONS } from './icons';

type Child = Node | string | number | null | undefined | false;
export type Props = Record<string, unknown>;

const PROPERTIES = new Set(['checked', 'value', 'disabled', 'selected', 'indeterminate', 'draggable']);

/** Creates an element: `h('button', { class: 'btn', onclick }, 'Label')`. Children are always text nodes, never HTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
    else if (PROPERTIES.has(k)) (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

/** Icons that point somewhere: mirrored when the text runs right to left, as Material asks. */
const MIRRORED = new Set(['arrow_back', 'chevron_right', 'subdirectory_arrow_right', 'undo', 'drive_file_move', 'open_in_new']);

/** Material Symbols icon; decorative unless a label is given. */
export function icon(name: string, label?: string, extraClass = ''): SVGSVGElement {
  const [viewBox, d] = ICONS[name] ?? ['0 0 24 24', ''];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('class', `icon ${MIRRORED.has(name) ? 'mirror ' : ''}${extraClass}`.trim());
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.append(path);
  return svg;
}

/** Site icon from the browser's favicon cache (Chrome), or a letter badge elsewhere. */
export function favicon(url: string, size = 16): HTMLElement {
  if (import.meta.env.BROWSER !== 'firefox') {
    const src = `${browser.runtime.getURL('/_favicon/' as never)}?pageUrl=${encodeURIComponent(url)}&size=${size * 2}`;
    return h('img', { class: 'favicon', src, width: size, height: size, alt: '', loading: 'lazy', draggable: false });
  }
  let letter = '•';
  try {
    letter = new URL(url).hostname.replace(/^www\./, '').charAt(0).toUpperCase() || '•';
  } catch {
    /* keep the bullet */
  }
  return h('span', { class: 'favicon favicon-letter', 'aria-hidden': 'true' }, letter);
}

/** Re-renders a container while keeping keyboard focus and scroll positions. */
export function replaceKeepingFocus(container: HTMLElement, next: HTMLElement): void {
  const active = document.activeElement as HTMLElement | null;
  const focusKey = active?.dataset.focus;
  const scrolls = [...container.querySelectorAll<HTMLElement>('[data-scroll]')].map((el) => [el.dataset.scroll, el.scrollTop, el.scrollLeft] as const);
  const pageY = window.scrollY;
  container.replaceChildren(next);
  for (const [key, top, left] of scrolls) {
    const el = container.querySelector<HTMLElement>(`[data-scroll="${key}"]`);
    if (el) {
      el.scrollTop = top;
      el.scrollLeft = left;
    }
  }
  window.scrollTo({ top: pageY });
  if (focusKey) container.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

/** Opens a menu in the top layer, under its anchor (or above when there is no room); light-dismissed like a native menu. */
export function openMenu(anchor: HTMLElement, content: HTMLElement[], label: string): HTMLElement {
  document.querySelectorAll('.menu').forEach((m) => m.remove());
  const menu = h('div', { class: 'menu', popover: 'auto', role: 'menu', 'aria-label': label }, content);
  document.body.append(menu);
  menu.addEventListener('toggle', (e) => {
    if ((e as ToggleEvent).newState === 'closed') {
      menu.remove();
      if (document.activeElement === document.body || !document.activeElement) anchor.focus({ preventScroll: true });
    }
  });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll<HTMLElement>('button, input, a[href]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    }
  });
  menu.showPopover();
  const r = anchor.getBoundingClientRect();
  const m = menu.getBoundingClientRect();
  const below = r.bottom + 4 + m.height <= window.innerHeight;
  menu.style.top = `${Math.max(8, below ? r.bottom + 4 : r.top - 4 - m.height)}px`;
  // Under its anchor, aligned on the side where the line of text ends.
  const x = getComputedStyle(anchor).direction === 'rtl' ? r.left : r.right - m.width;
  menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - m.width - 8))}px`;
  (menu.querySelector<HTMLElement>('[aria-current="true"]') ?? menu.querySelector<HTMLElement>('button, input'))?.focus();
  return menu;
}

export function closeMenus(): void {
  document.querySelectorAll<HTMLElement>('.menu').forEach((m) => m.hidePopover());
}

/** Announces a change to screen readers. */
export function announce(text: string): void {
  const region = document.getElementById('live');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = text;
  });
}
