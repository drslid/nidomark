/**
 * Folder names in every language of the interface: the groups ("g:<id>"), the categories ("<id>") and the special
 * folders. French and English live in the taxonomy itself; the other languages come from lib/data/names.
 */
import ar from './data/names/ar.json';
import bn from './data/names/bn.json';
import de from './data/names/de.json';
import es from './data/names/es.json';
import hi from './data/names/hi.json';
import id from './data/names/id.json';
import it from './data/names/it.json';
import ja from './data/names/ja.json';
import ko from './data/names/ko.json';
import nl from './data/names/nl.json';
import pl from './data/names/pl.json';
import ptBR from './data/names/pt-BR.json';
import ptPT from './data/names/pt-PT.json';
import ru from './data/names/ru.json';
import tr from './data/names/tr.json';
import uk from './data/names/uk.json';
import vi from './data/names/vi.json';
import zhCN from './data/names/zh-CN.json';
import zhTW from './data/names/zh-TW.json';

export const NAMES: Record<string, Record<string, string>> = {
  ar, bn, de, es, hi, id, it, ja, ko, nl, pl, 'pt-BR': ptBR, 'pt-PT': ptPT, ru, tr, uk, vi, 'zh-CN': zhCN, 'zh-TW': zhTW,
};

export type SpecialFolder = 'mine' | 'review' | 'special' | 'untitled';

const SPECIAL: Record<SpecialFolder, [fr: string, en: string]> = {
  mine: ['Mes dossiers', 'My folders'],
  review: ['À vérifier', 'To check'],
  special: ['Liens du navigateur', 'Browser links'],
  untitled: ['Sans titre', 'Untitled'],
};

/** Names of a language, or of the closest one ("pt" finds Brazilian Portuguese); none for French and English. */
export function namesFor(lang: string): Record<string, string> | undefined {
  const tag = lang.replace('_', '-');
  const exact = Object.keys(NAMES).find((k) => k.toLowerCase() === tag.toLowerCase());
  if (exact) return NAMES[exact];
  const base = tag.split('-')[0]?.toLowerCase() ?? '';
  return Object.entries(NAMES).find(([k]) => k.split('-')[0]?.toLowerCase() === base)?.[1];
}

/** Name of a folder key ("g:leisure", "cooking") in a language, from its French and English names. */
export function nameIn(key: string, fr: string, en: string, lang: string): string {
  if (lang.toLowerCase().startsWith('fr')) return fr;
  return namesFor(lang)?.[key] || en;
}

export function specialName(key: SpecialFolder, lang: string): string {
  return nameIn(key, SPECIAL[key][0], SPECIAL[key][1], lang);
}

/** A key's name in every language: a folder the user named in any of them is recognised. */
export function namesInEveryLanguage(key: string): string[] {
  return Object.values(NAMES).flatMap((m) => (m[key] ? [m[key] as string] : []));
}
