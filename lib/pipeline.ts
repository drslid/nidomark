import { MODEL_CATEGORIES, scopeCandidates } from './categorize';
import { type Duplicate, findDuplicates } from './duplicates';
import { computeFeatures } from './features';
import type { ArchiveSource } from './plan';
import { CATEGORIES, GROUPS, categoryPrototype, isBackupTitle, localName } from './taxonomy';
import type { Features, FolderItem, HistoryInfo, Snapshot, Usage } from './types';
import { USAGES } from './types';
import { isWebUrl } from './url';
import { leadingEmoji, stripEmoji } from './vocab';

/** Zero-shot descriptions of each usage (the model is multilingual, French works for every language). */
export const USAGE_DESCRIPTIONS: Record<Usage, string> = {
  access: 'Page de connexion ou tableau de bord d’un service ou d’un appareil : compte, administration, interface web d’un serveur',
  tool: 'Outil en ligne qui sert à faire une tâche : convertir, compresser, tester, dessiner, calculer, suivre un envoi',
  learn: 'Tutoriel, guide pas à pas, documentation ou recette pour apprendre à faire quelque chose',
  read: 'Article, billet de blog, retour d’expérience ou reportage à lire',
  follow: 'Page d’accueil d’un site d’actualités, d’un blog ou d’un agrégateur consulté régulièrement',
};

export interface Prepared {
  snapshot: Snapshot;
  features: Map<string, Features>;
  /** Bookmarks to sort. */
  candidates: string[];
  /** The web bookmarks among them, embedded by the model. */
  embedded: string[];
  /** Copies of a page kept elsewhere. */
  duplicates: Duplicate[];
  /** Folders the bookmarks can go to or stay in. */
  folders: FolderItem[];
  scopeFolderIds: string[];
  /** Texts to embed, in this order: candidates, usage descriptions, category descriptions, folder names. */
  texts: string[];
  lang: string;
}

/** Words a folder name gives the model; a folder named with an emoji only is described by what the emoji stands for. */
export function folderText(title: string, lang: string): string {
  const name = stripEmoji(title);
  if (name) return name;
  const emoji = leadingEmoji(title.trim());
  const group = GROUPS.find((g) => g.emoji === emoji);
  if (group) return localName(group, lang);
  const category = CATEGORIES.find((c) => c.emoji === emoji);
  return category ? localName(category, lang) : title || '—';
}

/** The scope by default: the whole tree. */
export function defaultScope(snapshot: Snapshot): string[] {
  return [snapshot.barId, snapshot.otherId, snapshot.mobileId].filter((x): x is string => !!x);
}

/** Choices of the scope picker that still make sense: root folders and the folders right inside them. */
export function pruneScope(snapshot: Snapshot, ids: string[]): string[] {
  const roots = new Set(defaultScope(snapshot));
  return ids.filter((id) => roots.has(id) || roots.has(snapshot.folders.get(id)?.parentId ?? ''));
}

/**
 * What a rebuild moves into the archive, root by root and in order: the bookmarks and folders at the top of each
 * chosen root, or a chosen folder itself. Earlier backups, managed bookmarks and folders left out stay where they are.
 */
export function archiveSources(snapshot: Snapshot, include: string[], exclude: string[], title: (rootId: string) => string): ArchiveSource[] {
  const inc = new Set(include);
  const exc = new Set(exclude);
  const out: ArchiveSource[] = [];
  for (const rootId of defaultScope(snapshot)) {
    const root = snapshot.folders.get(rootId);
    if (!root || root.unmodifiable) continue;
    const whole = inc.has(rootId) && !exc.has(rootId);
    const items: { id: string; index: number; expect: { parentId: string; title: string; url?: string } }[] = [];
    if (whole) {
      for (const id of root.bookmarkIds) {
        const b = snapshot.bookmarks.get(id);
        if (b && !b.unmodifiable) items.push({ id, index: b.index, expect: { parentId: rootId, title: b.title, url: b.url } });
      }
    }
    for (const id of root.folderIds) {
      const f = snapshot.folders.get(id);
      if (!f || f.unmodifiable || isBackupTitle(f.title) || exc.has(id) || !(whole || inc.has(id))) continue;
      items.push({ id, index: f.index ?? 0, expect: { parentId: rootId, title: f.title } });
    }
    items.sort((a, b) => a.index - b.index);
    if (items.length) out.push({ key: `archive:${rootId}`, title: title(rootId), items: items.map(({ id, expect }) => ({ id, expect })) });
  }
  return out;
}

/** Everything the analysis needs before running the model; pure, so that tests replay the exact same texts. */
export function prepare(snapshot: Snapshot, history: Map<string, HistoryInfo> | undefined, scopeFolderIds: string[], lang: string, excludedFolderIds: string[] = []): Prepared {
  const scope = scopeFolderIds.filter((id) => snapshot.folders.has(id));
  if (!scope.length) scope.push(...defaultScope(snapshot));
  const features = new Map<string, Features>();
  for (const b of snapshot.bookmarks.values()) if (isWebUrl(b.url)) features.set(b.id, computeFeatures(b, { history }));
  const candidates = scopeCandidates(snapshot, scope, excludedFolderIds);
  const duplicates = findDuplicates(snapshot, features, candidates);
  // Only web pages are embedded; other links (bookmarklets, browser pages) are filed apart.
  const embedded = candidates.filter((id) => features.has(id));
  const folders = [...snapshot.folders.values()].filter((f) => !f.isRoot && !f.unmodifiable && !isBackupTitle(f.title));
  const texts = [
    ...embedded.map((id) => (features.get(id) as Features).text),
    ...USAGES.map((u) => USAGE_DESCRIPTIONS[u]),
    ...MODEL_CATEGORIES.map((c) => categoryPrototype(c, lang)),
    ...folders.map((f) => folderText(f.title, lang)),
  ];
  return { snapshot, features, candidates, embedded, duplicates, folders, scopeFolderIds: scope, texts, lang };
}

export interface PreparedVectors {
  vectors: Map<string, Float32Array>;
  usageVectors: Record<Usage, Float32Array>;
  prototypes: Map<string, Float32Array>;
  folderVectors: Map<string, Float32Array>;
}

/** Splits the vectors of `p.texts`, computed in the same order. */
export function splitVectors(p: Prepared, vectors: Float32Array[]): PreparedVectors {
  let k = 0;
  const next = () => vectors[k++] as Float32Array;
  const byId = new Map(p.embedded.map((id) => [id, next()]));
  const usageVectors = Object.fromEntries(USAGES.map((u) => [u, next()])) as Record<Usage, Float32Array>;
  const prototypes = new Map(MODEL_CATEGORIES.map((c) => [c.id, next()]));
  const folderVectors = new Map(p.folders.map((f) => [f.id, next()]));
  return { vectors: byId, usageVectors, prototypes, folderVectors };
}
