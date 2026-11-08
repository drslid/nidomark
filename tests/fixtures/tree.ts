import { type CorpusItem, corpus } from './corpus.js';
import type { TreeNode } from '../../lib/snapshot';
import type { HistoryInfo } from '../../lib/types';

export const FOLDERS: Record<string, { id: string; title: string; parent: '1' | '2' }> = {
  'Barre/Outils': { id: 'f-outils', title: 'Outils', parent: '1' },
  'Autres/Domotique': { id: 'f-domotique', title: 'Domotique', parent: '2' },
  'Autres/Recettes': { id: 'f-recettes', title: 'Recettes', parent: '2' },
  'Autres/À lire': { id: 'f-alire', title: 'À lire', parent: '2' },
};

/** Where each bookmark should end up (destination "bookmarks bar", French), written by hand. */
export const EXPECTED_DEST: Record<string, string> = {
  b4: '(reste)', b5: '(reste)', b6: '(reste)', d1: '(reste)', d2: '(reste)', r1: '(reste)', a1: '(reste)',
  u1: 'Services maison', u2: 'Services maison', u3: 'Services maison', u4: 'Services maison', u5: 'Services maison', u6: 'Services maison', u7: 'Services maison', u8: 'Services maison',
  u9: 'Tech › Auto-hébergement', u10: 'Tech › Auto-hébergement', u11: 'Tech › Auto-hébergement', u12: 'Tech',
  u13: 'Tech › Développement', u14: 'Tech › Développement', u15: 'Tech › Développement', u16: 'Tech › Développement',
  u17: 'Outils', u18: 'Loisirs › Photo', u19: 'Loisirs › Photo', u20: 'Recettes', u21: 'Recettes', u22: 'Domotique', u23: 'Loisirs',
  u24: 'Tech › Actu tech', u25: 'Tech › Actu tech', u26: 'Voyages', u27: 'Voyages', u28: 'Voyages',
  u29: 'Vie pratique › Démarches', u30: 'Vie pratique', u31: 'Vie pratique › Démarches',
  v1: 'Loisirs › Streaming', v2: 'Tech › Actu tech', m1: '(reste)', m2: '(reste)', m3: '(reste)',
  v4: '(doublon)', v5: '(doublon)', v6: '(doublon)',
};

/** Variants of the collection used by the tests: bookmark id → folder key. */
export const SCENARIOS: Record<string, Record<string, string>> = {
  base: {},
  /** The user's "Domotique" folder already mixes a dashboard and guides. */
  topicFiler: { b1: 'Autres', u6: 'Autres/Domotique' },
  /** The user corrected a first proposal. */
  corrected: { u13: 'Autres/Développement web', u14: 'Autres/Développement web', u29: 'Autres/Démarches', u31: 'Autres/Démarches' },
};

/** Chrome-like bookmarks tree of the fictitious collection; `move` overrides the folder of some items. */
export function buildTree(move: Record<string, string> = {}): TreeNode[] {
  const items: CorpusItem[] = corpus.map((b) => ({ ...b, folder: move[b.id] ?? b.folder }));
  const node = (b: CorpusItem, index: number): TreeNode => ({ id: b.id, index, title: b.title, url: b.url });
  const childrenOf = (folder: string) => items.filter((b) => b.folder === folder).map(node);
  const keys = [...new Set([...Object.keys(FOLDERS), ...items.map((b) => b.folder)])].filter((k) => k.includes('/'));
  const folderInfo = (key: string) => FOLDERS[key] ?? { id: `f-${key.split('/')[1]}`, title: key.split('/')[1] as string, parent: key.startsWith('Barre') ? '1' : '2' };
  const sub = (key: string): TreeNode => {
    const f = folderInfo(key);
    return { id: f.id, parentId: f.parent, title: f.title, children: childrenOf(key) };
  };
  const subsOf = (parent: '1' | '2') => keys.filter((k) => folderInfo(k).parent === parent).map(sub);
  return [{
    id: '0', title: '', children: [
      { id: '1', parentId: '0', title: 'Barre de favoris', folderType: 'bookmarks-bar', children: [...childrenOf('Barre'), ...subsOf('1')] },
      { id: '2', parentId: '0', title: 'Autres favoris', folderType: 'other', children: [...subsOf('2'), ...childrenOf('Autres')] },
    ],
  }];
}

/** Browsing history as the browser would return it: real page title, visits and typed visits. */
export function corpusHistory(): Map<string, HistoryInfo> {
  return new Map(corpus.map((b) => [b.url, { title: b.page?.title, visitCount: b.visits, typedCount: b.typed }]));
}
