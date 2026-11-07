/** Public Suffix List (https://publicsuffix.org, MPL-2.0): registrable domain of a host name. */
interface Rules {
  exact: Set<string>;
  wildcard: Set<string>;
  exception: Set<string>;
}

let rules: Rules | null = null;

export function loadPublicSuffixList(text: string): void {
  const r: Rules = { exact: new Set(), wildcard: new Set(), exception: new Set() };
  for (const raw of text.split('\n')) {
    const line = raw.trim().split(/\s/)[0] ?? '';
    if (!line || line.startsWith('//')) continue;
    const rule = line.toLowerCase();
    if (rule.startsWith('!')) r.exception.add(rule.slice(1));
    else if (rule.startsWith('*.')) r.wildcard.add(rule.slice(2));
    else r.exact.add(rule);
  }
  rules = r;
}

export function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
}

/** Longest matching public suffix; the default rule "*" applies when nothing matches. */
export function publicSuffix(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (!rules) throw new Error('Public Suffix List not loaded');
  for (let i = 0; i < labels.length; i++) {
    const candidate = labels.slice(i).join('.');
    if (rules.exception.has(candidate)) return labels.slice(i + 1).join('.');
    if (rules.exact.has(candidate)) return candidate;
    if (i + 1 < labels.length && rules.wildcard.has(labels.slice(i + 1).join('.'))) return candidate;
  }
  return labels[labels.length - 1] ?? host;
}

export function isPublicSuffix(host: string): boolean {
  return !isIpAddress(host) && publicSuffix(host) === host.toLowerCase();
}

/** Registrable domain ("eTLD+1"): `jellyfin.maison-dupont.fr` → `maison-dupont.fr`. */
export function registrableDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (!h || isIpAddress(h) || !h.includes('.')) return h;
  const suffix = publicSuffix(h);
  if (suffix === h) return h;
  const rest = h.slice(0, h.length - suffix.length - 1).split('.');
  return `${rest[rest.length - 1]}.${suffix}`;
}
