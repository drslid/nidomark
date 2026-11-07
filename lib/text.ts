/** Text normalisation, words and TF-IDF keyword similarity. */
export function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const STOPWORDS = new Set(
  (
    'le la les un une des de du d l et ou en au aux a pour par sur avec dans ce ces cette son sa ses vos votre nos notre mon ma mes je j vous nous il elle on qui que quoi est sont ete etre ' +
    'the of and or for to in on with your you how set up an is are by from at as it its this that be can my our www com fr org net io co uk de html htm aspx php web index home page ' +
    'tutoriel tuto guide complet complete debuter debutant comment pas etape etapes getting started decouvrez facile rapide minutes jours pourquoi comprendre astuces reglages bien plus tot ' +
    'aime connaitre retour experience notre itineraire mais tout toute toutes premiers premiere premier ajouter installer install dix new free best top official site accueil welcome'
  ).split(' '),
);

/** Content words of a text, accents folded, stop words and numbers removed. */
export function words(text: string): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export type SparseVector = Map<string, number>;

/** L2-normalised TF-IDF vectors for a list of documents given as word lists. */
export function tfidf(docs: string[][]): SparseVector[] {
  const n = docs.length;
  const df = new Map<string, number>();
  for (const doc of docs) for (const w of new Set(doc)) df.set(w, (df.get(w) ?? 0) + 1);
  return docs.map((doc) => {
    const v: SparseVector = new Map();
    for (const w of doc) v.set(w, (v.get(w) ?? 0) + Math.log((n + 1) / ((df.get(w) ?? 0) + 0.5)));
    let norm = 0;
    for (const x of v.values()) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    for (const [k, x] of v) v.set(k, x / norm);
    return v;
  });
}

export function sparseDot(a: SparseVector, b: SparseVector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let s = 0;
  for (const [k, x] of small) {
    const y = large.get(k);
    if (y !== undefined) s += x * y;
  }
  return s;
}
