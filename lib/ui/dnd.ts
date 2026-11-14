/** Drag and drop on the review screen: bookmarks from the side sheet, folders from the canvas. */

export const BOOKMARK_TYPE = 'application/x-nidomark-bookmark';
export const FOLDER_TYPE = 'application/x-nidomark-folder';

export type Dragged = { kind: 'bookmark'; id: string } | { kind: 'folder'; key: string };

let dragged: Dragged | null = null;
const targets = new WeakMap<HTMLElement, (d: Dragged) => boolean>();

/** Starts dragging a bookmark or a folder: every place that can take it lights up. */
export function startDrag(e: DragEvent, what: Dragged, label: string): void {
  dragged = what;
  const dt = e.dataTransfer;
  if (dt) {
    dt.setData(what.kind === 'bookmark' ? BOOKMARK_TYPE : FOLDER_TYPE, what.kind === 'bookmark' ? what.id : what.key);
    dt.setData('text/plain', label);
    dt.effectAllowed = 'move';
  }
  document.querySelector('.board')?.classList.add('drag-active');
  document.querySelectorAll<HTMLElement>('[data-drop]').forEach((el) => el.classList.toggle('can-drop', !!targets.get(el)?.(what)));
}

export function endDrag(): void {
  dragged = null;
  document.querySelector('.board')?.classList.remove('drag-active');
  document.querySelectorAll('.can-drop, .drop-target, .dragging').forEach((el) => el.classList.remove('can-drop', 'drop-target', 'dragging'));
}

/** Makes an element take what `accepts` lets in. */
export function dropTarget<T extends HTMLElement>(el: T, accepts: (d: Dragged) => boolean, onDrop: (d: Dragged) => void): T {
  targets.set(el, accepts);
  el.dataset.drop = '';
  el.addEventListener('dragover', (e) => {
    if (!dragged || !accepts(dragged)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    el.classList.add('drop-target');
  });
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget as Node | null)) el.classList.remove('drop-target');
  });
  el.addEventListener('drop', (e) => {
    const d = dragged;
    endDrag();
    if (!d || !accepts(d)) return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(d);
  });
  return el;
}

/** Makes an element draggable as a bookmark or a folder. */
export function draggable<T extends HTMLElement>(el: T, what: () => Dragged, label: () => string): T {
  el.draggable = true;
  el.addEventListener('dragstart', (e) => {
    e.stopPropagation();
    startDrag(e, what(), label());
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => endDrag());
  return el;
}
