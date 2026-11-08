import type { BookmarksApi, Journal, JournalStore } from '../../lib/plan';
import type { TreeNode } from '../../lib/snapshot';

interface Node {
  id: string;
  parentId?: string;
  title: string;
  url?: string;
  dateAdded: number;
  children?: string[];
}

/** In-memory bookmarks API reproducing Chrome's behaviour (root folders protected, non-empty folders not removable). */
export class FakeBookmarks implements BookmarksApi {
  nodes = new Map<string, Node>();
  /** Number of changes made, to simulate a crash after a given change. */
  mutations = 0;
  private next = 1000;

  constructor(tree: TreeNode[]) {
    const add = (n: TreeNode, parentId?: string) => {
      this.nodes.set(n.id, { id: n.id, parentId, title: n.title, url: n.url, dateAdded: n.dateAdded ?? 1, children: n.url === undefined ? [] : undefined });
      if (parentId) this.nodes.get(parentId)?.children?.push(n.id);
      for (const c of n.children ?? []) add(c, n.id);
    };
    for (const n of tree) add(n);
  }

  private node(id: string): Node {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Can't find bookmark for id.`);
    return n;
  }

  private view(n: Node) {
    const parent = n.parentId ? this.nodes.get(n.parentId) : undefined;
    return { id: n.id, parentId: n.parentId, index: parent?.children?.indexOf(n.id), title: n.title, url: n.url, dateAdded: n.dateAdded };
  }

  private isRoot(id: string) {
    const n = this.node(id);
    return n.parentId === undefined || n.parentId === '0';
  }

  async get(id: string) {
    return [this.view(this.node(id))];
  }

  async getChildren(id: string) {
    return (this.node(id).children ?? []).map((c) => this.view(this.node(c)));
  }

  async create(d: { parentId: string; title: string; url?: string; index?: number }) {
    this.mutations++;
    const id = String(this.next++);
    this.nodes.set(id, { id, parentId: d.parentId, title: d.title, url: d.url, dateAdded: Date.now(), children: d.url === undefined ? [] : undefined });
    const siblings = this.node(d.parentId).children as string[];
    siblings.splice(d.index ?? siblings.length, 0, id);
    return { id };
  }

  async move(id: string, dest: { parentId: string; index?: number }) {
    if (this.isRoot(id)) throw new Error("Can't modify the root bookmark folders.");
    this.mutations++;
    const n = this.node(id);
    const from = this.node(n.parentId as string).children as string[];
    from.splice(from.indexOf(id), 1);
    const to = this.node(dest.parentId).children as string[];
    to.splice(Math.min(dest.index ?? to.length, to.length), 0, id);
    n.parentId = dest.parentId;
    return this.view(n);
  }

  async update(id: string, changes: { title?: string; url?: string }) {
    if (this.isRoot(id)) throw new Error("Can't modify the root bookmark folders.");
    this.mutations++;
    const n = this.node(id);
    if (changes.title !== undefined) n.title = changes.title;
    if (changes.url !== undefined) n.url = changes.url;
    return this.view(n);
  }

  async remove(id: string) {
    this.mutations++;
    const n = this.node(id);
    if (n.children?.length) throw new Error("Can't remove non-empty folder (use recursive to force).");
    const siblings = this.node(n.parentId as string).children as string[];
    siblings.splice(siblings.indexOf(id), 1);
    this.nodes.delete(id);
  }

  async removeTree(id: string) {
    this.mutations++;
    const n = this.node(id);
    const drop = (x: string) => {
      for (const c of this.nodes.get(x)?.children ?? []) drop(c);
      this.nodes.delete(x);
    };
    const siblings = this.node(n.parentId as string).children as string[];
    siblings.splice(siblings.indexOf(id), 1);
    drop(id);
  }

  /** Comparable state: id, parent, position, title, url and dateAdded of every node. */
  state(): string {
    return JSON.stringify([...this.nodes.values()].map((n) => this.view(n)).sort((a, b) => a.id.localeCompare(b.id)));
  }
}

export class MemoryJournal implements JournalStore {
  value: Journal | null = null;
  /** When set, the save that would record the change number `crashAfter` as done fails, like a closed tab. */
  constructor(private api?: FakeBookmarks, private crashAfter = Infinity) {}
  async load() {
    return this.value ? (JSON.parse(JSON.stringify(this.value)) as Journal) : null;
  }
  async save(j: Journal) {
    if (this.api && this.api.mutations >= this.crashAfter && j.entries.at(-1)?.status !== 'pending') throw new Error('crash');
    this.value = JSON.parse(JSON.stringify(j)) as Journal;
  }
  /** The browser restarts: saving works again. */
  restart() {
    this.crashAfter = Infinity;
  }
}
