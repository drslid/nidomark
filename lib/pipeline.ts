import type { ClassifyInput } from './classify';
import { computeFeatures } from './features';
import type { Features, FolderItem, HistoryInfo, Snapshot, Usage } from './types';
import { USAGES } from './types';
import { isWebUrl } from './url';
import { VOCAB, vocabLabelText } from './vocab';

/** Zero-shot descriptions of each usage (the model is multilingual, French works for every language). */
export const USAGE_DESCRIPTIONS: Record<Usage, string> = {
  access: 'Page de connexion ou tableau de bord d’un service ou d’un appareil : compte, administration, interface web d’un serveur',
  tool: 'Outil en ligne qui sert à faire une tâche : convertir, compresser, tester, dessiner, calculer, suivre un envoi',
  learn: 'Tutoriel, guide pas à pas, documentation ou recette pour apprendre à faire quelque chose',
  read: 'Article, billet de blog, retour d’expérience ou reportage à lire',
  follow: 'Page d’accueil d’un site d’actualités, d’un blog ou d’un agrégateur consulté régulièrement',
};

/** How many bookmarks of each destination folder are embedded to describe it. */
export const MEMBERS_PER_FOLDER = 40;

export interface Prepared {
  snapshot: Snapshot;
  features: Map<string, Features>;
  sources: string[];
  docIds: string[];
  folders: FolderItem[];
  /** Texts to embed, in this order: documents, usage descriptions, vocabulary labels, folder titles. */
  texts: string[];
  lang: string;
}

/** Everything the analysis needs before running the model; pure, so that tests replay the exact same texts. */
export function prepare(snapshot: Snapshot, history: Map<string, HistoryInfo> | undefined, sourceFolderIds: string[], lang: string): Prepared {
  const sources = sourceFolderIds.filter((id) => snapshot.folders.has(id) && !snapshot.folders.get(id)?.unmodifiable);
  if (!sources.length && snapshot.otherId) sources.push(snapshot.otherId);

  const features = new Map<string, Features>();
  for (const b of snapshot.bookmarks.values()) if (isWebUrl(b.url)) features.set(b.id, computeFeatures(b, { history }));

  // Embed the bookmarks to organize and a sample of each destination folder, not the whole collection.
  const sourceSet = new Set(sources);
  const ids = new Set<string>();
  for (const b of snapshot.bookmarks.values()) if (sourceSet.has(b.parentId) && features.has(b.id) && !b.unmodifiable) ids.add(b.id);
  const folders = [...snapshot.folders.values()].filter((f) => !f.isRoot && !sourceSet.has(f.id) && !f.unmodifiable);
  for (const f of folders) for (const id of f.bookmarkIds.filter((x) => features.has(x)).slice(0, MEMBERS_PER_FOLDER)) ids.add(id);
  const docIds = [...ids];
  const texts = [
    ...docIds.map((id) => (features.get(id) as Features).text),
    ...USAGES.map((u) => USAGE_DESCRIPTIONS[u]),
    ...VOCAB.map((v) => vocabLabelText(v, lang)),
    ...folders.map((f) => f.title || '—'),
  ];
  return { snapshot, features, sources, docIds, folders, texts, lang };
}

/** Builds the classifier input from the prepared analysis and the vectors of `p.texts`, in the same order. */
export function toClassifyInput(p: Prepared, vectors: Float32Array[], examples: Map<string, string>): ClassifyInput {
  let k = 0;
  const next = () => vectors[k++] as Float32Array;
  const vecById = new Map(p.docIds.map((id) => [id, next()]));
  const usageVectors = Object.fromEntries(USAGES.map((u) => [u, next()])) as Record<Usage, Float32Array>;
  const labels = VOCAB.map((entry) => ({ entry, vector: next() }));
  const folderVectors = new Map(p.folders.map((f) => [f.id, next()]));
  return { snapshot: p.snapshot, features: p.features, vectors: vecById, usageVectors, labels, folderVectors, sourceFolderIds: p.sources, examples, lang: p.lang };
}
