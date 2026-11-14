import type { Analysis } from '../analyze';
import { type SuggestionTarget, suggestionTarget } from '../edit';
import { rootFolderName, t, uiLanguage } from '../i18n';
import type { Decisions } from '../plan';
import { localName } from '../taxonomy';
import type { Reason } from '../types';
import { type DestNode, type Layout, nodeKeyOf } from './viewmodel';

export function reasonText(r: Reason): string {
  return t(r.key, ...(r.subs ?? []));
}

/** Title a bookmark will have: the name the user gave it, the cleaner title accepted, or its current title. */
export function bookmarkTitle(an: Analysis, d: Decisions, id: string): string {
  const tt = d.titles[id];
  return tt?.accepted ? tt.title : (an.snapshot.bookmarks.get(id)?.title ?? '');
}

/** Name of a root folder as the browser shows it ("Bookmarks bar", "Barre de favoris"). */
export function rootTitle(an: Analysis, rootId: string | undefined): string {
  const snap = an.snapshot;
  const kind = rootId === snap.barId ? 'bar' : rootId === snap.otherId ? 'other' : 'mobile';
  return rootFolderName(kind, snap.folders.get(rootId ?? '')?.title ?? '');
}

/** "To check" shows the amber help icon, unless the user gave it an emoji of their own. */
export function ownEmoji(n: DestNode): string {
  return n.kind === 'review' && n.emoji === '❓' ? '' : n.emoji;
}

export function nodeTitle(n: DestNode): string {
  if (n.kind === 'bar') return t('nodeBar');
  if (n.kind === 'dupes') return t('nodeDupes');
  if (n.kind === 'removed') return t('nodeRemoved');
  if (n.kind === 'existing') return n.name || t('nodeLoose');
  return n.name || t('unnamed');
}

/** Names of the root folder and of the folders above a node. */
export function nodePath(an: Analysis, lay: Layout, key: string): string[] {
  const names: string[] = [];
  for (let k = lay.parent.get(key), i = 0; k && i < 64; k = lay.parent.get(k), i++) names.unshift(lay.byKey.get(k)?.name ?? '');
  return [rootTitle(an, lay.byKey.get(key)?.rootId), ...names];
}

export function host(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.port ? `:${u.port}` : ''}`;
  } catch {
    return url;
  }
}

/** Where the suggestions for a bookmark to check lead, in the tree under review. */
export function suggestionsFor(an: Analysis, lay: Layout, id: string): SuggestionTarget[] {
  const snap = an.snapshot;
  const lang = uiLanguage();
  const destinationRoot = (an.destination === 'bar' ? snap.barId : snap.otherId) ?? snap.otherId ?? snap.barId ?? '';
  const site = an.features.get(id)?.registrable ?? '';
  const out: SuggestionTarget[] = [];
  for (const category of an.proposal.suggestions[id] ?? []) {
    const s = suggestionTarget(lay.tree, category, site, { lang, destinationRoot, otherRoot: snap.otherId ?? destinationRoot, localName: (x) => localName(x, lang) });
    if (s && !out.some((o) => o.key === s.key) && lay.where.get(id) !== (s.create ? '' : nodeKeyOf(s.key))) out.push(s);
  }
  return out;
}

/** "Maison › Recettes", with "new" when the folder is to be made. */
export function suggestionLabel(s: SuggestionTarget): string {
  return [...s.path, s.name].join(' › ') + (s.create ? ` (${t('newShort')})` : '');
}
