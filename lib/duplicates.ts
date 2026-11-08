import { isBackupTitle } from './taxonomy';
import type { Features, Snapshot } from './types';

/** Parameters that only say where a click came from. */
const TRACKING = /^(utm_[a-z]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|yclid|mc_cid|mc_eid|igshid|_hsenc|_hsmi|ref_src|si)$/i;

/**
 * The page an address points to, for comparisons: no scheme, no "www.", no default port, no trailing slash,
 * no tracking parameters. The fragment is kept: in web apps it often names a different screen.
 */
export function normalizeUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return u.href;
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const params = [...u.searchParams].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  const hash = u.hash && u.hash !== '#' ? u.hash : '';
  return `${host}${u.port ? `:${u.port}` : ''}${path}${query}${hash}`;
}

export interface Duplicate {
  /** The copy removed. */
  bookmarkId: string;
  /** The copy kept. */
  keepId: string;
}

/**
 * Copies of the same page: one is kept, the others can be removed. Only the bookmarks being sorted can be
 * removed; a copy in the bookmarks bar, in a folder left out, in a managed folder or in a backup is always kept,
 * and then every sorted copy of it goes.
 */
export function findDuplicates(snapshot: Snapshot, features: Map<string, Features>, candidates: string[]): Duplicate[] {
  const removable = new Set(candidates);
  const inBackup = new Map<string, boolean>();
  const backedUp = (folderId: string): boolean => {
    const known = inBackup.get(folderId);
    if (known !== undefined) return known;
    const f = snapshot.folders.get(folderId);
    const v = !!f && !f.isRoot && (isBackupTitle(f.title) || (!!f.parentId && backedUp(f.parentId)));
    inBackup.set(folderId, v);
    return v;
  };
  const groups = new Map<string, string[]>();
  for (const b of snapshot.bookmarks.values()) {
    if (backedUp(b.parentId)) continue;
    const key = normalizeUrl(b.url);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), b.id]);
  }
  const out: Duplicate[] = [];
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    const fixed = ids.filter((id) => !removable.has(id));
    let keep: string;
    if (fixed.length) keep = fixed[0] as string;
    else {
      // The most telling title, then the copy filed in a folder, then the oldest.
      const score = (id: string) => {
        const b = snapshot.bookmarks.get(id);
        const f = features.get(id);
        return (f && !f.vagueTitle ? 1000 : 0) + Math.min((b?.title ?? '').length, 200) + (snapshot.folders.get(b?.parentId ?? '')?.isRoot ? 0 : 300);
      };
      keep = [...ids].sort((a, b) => score(b) - score(a) || (snapshot.bookmarks.get(a)?.dateAdded ?? 0) - (snapshot.bookmarks.get(b)?.dateAdded ?? 0))[0] as string;
    }
    for (const id of ids) if (id !== keep && removable.has(id)) out.push({ bookmarkId: id, keepId: keep });
  }
  return out;
}
