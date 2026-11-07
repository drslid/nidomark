export interface CorpusPage {
  title: string;
  desc: string;
  heads: string[];
  text: string;
}

export interface CorpusItem {
  id: string;
  folder: string;
  title: string;
  url: string;
  visits: number;
  typed: number;
  role: string;
  page: CorpusPage | null;
}

export const corpus: CorpusItem[];
export function urlWords(u: string): string;
export function textFor(b: CorpusItem, level: number): string;
