import { browser } from 'wxt/browser';
import pslText from './data/public_suffix_list.dat?raw';
import { classify } from './classify';
import type { EmbedProgress, Embedder } from './embedder';
import { prepare, toClassifyInput } from './pipeline';
import { loadPublicSuffixList } from './psl';
import { buildSnapshot, type TreeNode } from './snapshot';
import type { Features, HistoryInfo, Proposal, Snapshot } from './types';

loadPublicSuffixList(pslText);

export type AnalysisPhase = 'reading' | 'loading' | 'embedding' | 'grouping';

export interface Analysis {
  snapshot: Snapshot;
  features: Map<string, Features>;
  proposal: Proposal;
  sourceFolderIds: string[];
}

export interface AnalyzeOptions {
  embedder: Embedder;
  useHistory: boolean;
  sourceFolderIds: string[];
  examples: Map<string, string>;
  lang: string;
  onProgress: (phase: AnalysisPhase, done: number, total: number) => void;
}

async function readHistory(): Promise<Map<string, HistoryInfo>> {
  const items = await browser.history.search({ text: '', startTime: 0, maxResults: 0 });
  return new Map(items.filter((h) => h.url).map((h) => [h.url as string, { title: h.title, visitCount: h.visitCount ?? 0, typedCount: h.typedCount ?? 0 }]));
}

export async function analyze(o: AnalyzeOptions): Promise<Analysis> {
  o.onProgress('reading', 0, 1);
  const snapshot = buildSnapshot((await browser.bookmarks.getTree()) as TreeNode[]);
  const history = o.useHistory ? await readHistory().catch(() => new Map<string, HistoryInfo>()) : undefined;
  const prepared = prepare(snapshot, history, o.sourceFolderIds, o.lang);
  const vectors = await o.embedder.embed(prepared.texts, (p: EmbedProgress) => o.onProgress(p.phase, p.done, p.total));
  o.onProgress('grouping', 0, 1);
  const proposal = classify(toClassifyInput(prepared, vectors, o.examples));
  return { snapshot, features: prepared.features, proposal, sourceFolderIds: prepared.sources };
}
