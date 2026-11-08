/**
 * Reads bookmarked pages to understand them and to find the ones that no longer answer.
 * Only the bookmarked address itself is requested, without cookies or referrer; nothing else is sent.
 */
import { registrableDomain } from './psl';
import { fold } from './text';

export interface PageInfo {
  /** Address after redirects. */
  url: string;
  status: number;
  title: string;
  description: string;
  siteName: string;
  ogType: string;
  keywords: string;
  lang: string;
  headings: string[];
  /** Beginning of the readable text. */
  text: string;
  /** The page declares adult content (rating meta tag or RTA label). */
  adult: boolean;
}

export type DeadReason = 'network' | 'timeout' | 'gone' | 'server' | 'parked';

export type SiteVerdict =
  | { kind: 'ok'; page: PageInfo }
  /** The site answers but refuses to be read (login wall, bot protection, rate limit): it is alive. */
  | { kind: 'blocked'; status: number }
  | { kind: 'dead'; reason: DeadReason; status?: number }
  /** Not decided: offline, interrupted, or the network looked unreliable. */
  | { kind: 'unknown' };

/** What the reader needs from `fetch` (a Response satisfies it). */
export interface FetchedResponse {
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<FetchedResponse>;

export interface ReadOptions {
  timeoutMs: number;
  /** Bytes of HTML to read: enough for the head and the first paragraphs. */
  maxBytes: number;
  fetch?: FetchLike;
  signal?: AbortSignal;
}

const PARKING_HOSTS = new Set([
  'sedoparking.com', 'sedo.com', 'parkingcrew.net', 'bodis.com', 'dan.com', 'afternic.com', 'hugedomains.com', 'above.com', 'parklogic.com',
  'uniregistry.com', 'undeveloped.com', 'buydomains.com', 'domainmarket.com', 'sav.com', 'atom.com', 'squadhelp.com', 'efty.com', 'parked.com',
  'domainnameshop.com', 'perfectdomain.com', 'brandbucket.com', 'domainagents.com', 'smartname.com', 'expireddomains.net',
]);

const PARKED_PHRASES = [
  'this domain is for sale', 'domain is for sale', 'buy this domain', 'this domain may be for sale', 'the domain has expired', 'domain has expired',
  'domain expired', 'this domain has been registered', 'parked free', 'domain parking', 'is parked', 'parked domain', 'ce nom de domaine est a vendre',
  'ce domaine est a vendre', 'nom de domaine a vendre', 'domaine a vendre', 'domaine en vente', 'ce domaine a expire', 'le domaine a expire',
  'account suspended', 'this account has been suspended', 'site suspendu', 'hebergement suspendu', 'domaine suspendu', 'website expired',
  'welcome to nginx', 'apache2 ubuntu default page', 'apache2 debian default page', 'it works!', 'web server s default page',
  'plesk default page', 'default web site page', 'site en construction ovh', 'votre site est en cours de construction', 'future home of',
];

function parkedText(text: string): boolean {
  const t = fold(text).replace(/\s+/g, ' ');
  return PARKED_PHRASES.some((p) => t.includes(p));
}

/** Bot protections (Cloudflare and others) answer 403 or 503 to a request without cookies: the site is alive. */
const CHALLENGE_PHRASES = ['just a moment', 'checking your browser', 'attention required', 'enable javascript and cookies', 'ddos protection', 'verify you are human', 'un instant', 'verification de securite', 'captcha'];
/** Error pages of a proxy that could not find the site: the site is dead, not the proxy. */
const PROXY_DNS_PHRASES = ['err_dns_fail', 'unable to determine ip address', 'could not be resolved', 'name or service not known', 'dns lookup', 'dns resolution', 'err_name_not_resolved', 'unknown host', 'host not found', 'no such host'];

function hasPhrase(text: string, phrases: string[]): boolean {
  const t = fold(text).replace(/\s+/g, ' ');
  return phrases.some((p) => t.includes(p));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ocirc: 'ô', ecirc: 'ê', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

function metaContent(head: string, attr: 'name' | 'property', key: string): string {
  const re = new RegExp(`<meta\\b[^>]*\\b${attr}\\s*=\\s*["']${key}["'][^>]*>`, 'i');
  const tag = head.match(re)?.[0];
  if (!tag) return '';
  const content = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] ?? '';
  return clean(content);
}

/** Extracts what describes a page from the beginning of its HTML. Text only: nothing is ever rendered. */
export function extractPage(html: string, url: string, status: number): PageInfo {
  const noise = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const headEnd = noise.search(/<\/head\s*>/i);
  const head = headEnd > 0 ? noise.slice(0, headEnd) : noise.slice(0, 20000);
  const body = headEnd > 0 ? noise.slice(headEnd) : noise;
  const title = clean(noise.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '') || metaContent(head, 'property', 'og:title');
  const description = metaContent(head, 'name', 'description') || metaContent(head, 'property', 'og:description') || metaContent(head, 'name', 'twitter:description');
  const rating = `${metaContent(head, 'name', 'rating')} ${metaContent(head, 'name', 'RATING')}`.toLowerCase();
  const headings = [...body.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]\s*>/gi)].map((m) => clean(m[1] ?? '')).filter((h) => h.length > 2).slice(0, 6);
  let text = '';
  for (const m of body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)) {
    const p = clean(m[1] ?? '');
    if (p.length < 40) continue;
    text += `${text ? ' ' : ''}${p}`;
    if (text.length > 400) break;
  }
  return {
    url,
    status,
    title: title.slice(0, 200),
    description: description.slice(0, 400),
    siteName: metaContent(head, 'property', 'og:site_name').slice(0, 80),
    ogType: metaContent(head, 'property', 'og:type').toLowerCase(),
    keywords: metaContent(head, 'name', 'keywords').slice(0, 200),
    lang: (noise.match(/<html\b[^>]*\blang\s*=\s*["']?([a-z-]+)/i)?.[1] ?? '').toLowerCase(),
    headings,
    text: text.slice(0, 400),
    adult: /\b(adult|mature|rta-5042-1996-1400-1577-rta)\b/.test(rating) || /RTA-5042-1996-1400-1577-RTA/.test(head),
  };
}

/** Charset from the Content-Type header or the first bytes of the document. */
function charsetOf(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = contentType?.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const start = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  return (start.match(/<meta\b[^>]*charset\s*=\s*["']?([\w-]+)/i)?.[1] ?? 'utf-8').toLowerCase();
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

async function readBody(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (size < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      size += value.length;
    }
  } finally {
    // Stop the download once enough has been read.
    reader.cancel().catch(() => undefined);
  }
  const out = new Uint8Array(Math.min(size, maxBytes));
  let offset = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.min(c.length, out.length - offset));
    out.set(part, offset);
    offset += part.length;
    if (offset >= out.length) break;
  }
  return out;
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

/** Reads one page. Network failures and timeouts are reported as dead; the caller retries them once. */
export async function readSite(url: string, o: ReadOptions): Promise<SiteVerdict> {
  const doFetch: FetchLike = o.fetch ?? ((u, init) => fetch(u, init));
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, o.timeoutMs);
  const onAbort = () => ctrl.abort();
  o.signal?.addEventListener('abort', onAbort);
  // The deadline holds even if a request or a body stream ignores the abort signal.
  const deadline = new Promise<never>((_, reject) => ctrl.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  deadline.catch(() => undefined);
  try {
    const res = await Promise.race([doFetch(url, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      signal: ctrl.signal,
    }), deadline]);
    const finalUrl = res.url || url;
    const status = res.status;
    if (status === 404 || status === 410) {
      res.body?.cancel().catch(() => undefined);
      return { kind: 'dead', reason: 'gone', status };
    }
    // A proxy that wants a password says nothing about the site.
    if (status === 407) {
      res.body?.cancel().catch(() => undefined);
      return { kind: 'unknown' };
    }
    if (status >= 400) {
      const challenged = !!res.headers.get('cf-mitigated');
      const text = challenged ? '' : decode(await Promise.race([readBody(res.body, 16384), deadline]), 'utf-8');
      if (status >= 500 && hasPhrase(text, PROXY_DNS_PHRASES)) return { kind: 'dead', reason: 'network', status };
      if (challenged || hasPhrase(text, CHALLENGE_PHRASES)) return { kind: 'blocked', status };
      // 503 is mostly maintenance or rate limiting; other server errors mean the page is broken.
      if (status >= 500 && status !== 503) return { kind: 'dead', reason: 'server', status };
      return { kind: 'blocked', status };
    }
    const finalHost = hostOf(finalUrl);
    if (PARKING_HOSTS.has(registrableDomain(finalHost)) && registrableDomain(finalHost) !== registrableDomain(hostOf(url))) {
      res.body?.cancel().catch(() => undefined);
      return { kind: 'dead', reason: 'parked', status };
    }
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|xml/i.test(type)) {
      res.body?.cancel().catch(() => undefined);
      return { kind: 'ok', page: { url: finalUrl, status, title: '', description: '', siteName: '', ogType: type.split(';')[0] ?? '', keywords: '', lang: '', headings: [], text: '', adult: false } };
    }
    const bytes = await Promise.race([readBody(res.body, o.maxBytes), deadline]);
    const page = extractPage(decode(bytes, charsetOf(type, bytes)), finalUrl, status);
    if (parkedText(`${page.title} ${page.description} ${page.headings.join(' ')} ${page.text}`)) return { kind: 'dead', reason: 'parked', status };
    return { kind: 'ok', page };
  } catch {
    if (o.signal?.aborted) return { kind: 'unknown' };
    return { kind: 'dead', reason: timedOut ? 'timeout' : 'network' };
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onAbort);
  }
}

export interface SiteRequest {
  id: string;
  url: string;
  /** Pages to understand are read further than pages that are only checked. */
  maxBytes: number;
}

export interface PoolOptions {
  concurrency: number;
  perHost: number;
  timeoutMs: number;
  retryTimeoutMs: number;
  fetch?: FetchLike;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

export const DEFAULT_POOL: Omit<PoolOptions, 'fetch' | 'signal' | 'onProgress'> = { concurrency: 16, perHost: 2, timeoutMs: 12000, retryTimeoutMs: 20000 };

async function runPool(items: SiteRequest[], o: PoolOptions, timeoutMs: number, onDone: (r: SiteRequest, v: SiteVerdict) => boolean): Promise<void> {
  const queue = [...items];
  const perHost = new Map<string, number>();
  let active = 0;
  let stopped = false;
  await new Promise<void>((resolve) => {
    const pump = () => {
      if (stopped || o.signal?.aborted) {
        if (active === 0) resolve();
        return;
      }
      while (active < o.concurrency && queue.length) {
        const i = queue.findIndex((r) => (perHost.get(hostOf(r.url)) ?? 0) < o.perHost);
        if (i < 0) break;
        const [req] = queue.splice(i, 1) as [SiteRequest];
        const host = hostOf(req.url);
        perHost.set(host, (perHost.get(host) ?? 0) + 1);
        active++;
        void readSite(req.url, { timeoutMs, maxBytes: req.maxBytes, fetch: o.fetch, signal: o.signal }).then((v) => {
          active--;
          perHost.set(host, (perHost.get(host) ?? 1) - 1);
          if (!onDone(req, v)) stopped = true;
          pump();
        });
      }
      if (active === 0 && (!queue.length || stopped)) resolve();
    };
    pump();
  });
}

/**
 * Reads many pages in parallel, at most `perHost` at a time on one site. Pages that failed are retried once,
 * more slowly. If nearly everything fails, the computer is probably offline: nothing is reported dead then.
 */
export async function readSites(items: SiteRequest[], o: PoolOptions): Promise<Map<string, SiteVerdict>> {
  const results = new Map<string, SiteVerdict>();
  let done = 0;
  let failures = 0;
  const total = items.length;
  const isFailure = (v: SiteVerdict) => v.kind === 'dead' && (v.reason === 'network' || v.reason === 'timeout');
  await runPool(items, o, o.timeoutMs, (r, v) => {
    results.set(r.id, v);
    if (isFailure(v)) failures++;
    o.onProgress?.(++done, total);
    // Offline: the first answers all failed.
    return !(done >= 12 && failures === done);
  });
  const answered = [...results.values()].filter((v) => !isFailure(v)).length;
  const offline = results.size >= 12 && answered === 0;
  if (!offline) {
    const retry = items.filter((r) => {
      const v = results.get(r.id);
      return v && v.kind === 'dead' && v.reason !== 'gone' && v.reason !== 'parked';
    });
    if (retry.length && !o.signal?.aborted) {
      await runPool(retry, { ...o, concurrency: Math.max(2, Math.floor(o.concurrency / 2)) }, o.retryTimeoutMs, (r, v) => {
        results.set(r.id, v);
        return true;
      });
    }
  }
  // An unreliable connection (most sites failing) proves nothing about each site.
  const failedNow = [...results.values()].filter(isFailure).length;
  const unreliable = offline || (results.size >= 20 && failedNow / results.size > 0.6);
  for (const r of items) {
    const v = results.get(r.id);
    if (!v || (unreliable && isFailure(v))) results.set(r.id, { kind: 'unknown' });
  }
  o.onProgress?.(total, total);
  return results;
}

/** Text describing a page for the model, from its most informative parts. */
export function pageText(p: PageInfo): string {
  const parts = [p.title, p.siteName && !fold(p.title).includes(fold(p.siteName)) ? p.siteName : '', p.description, p.headings.slice(0, 3).join(' · '), p.description ? '' : p.text];
  return parts.filter(Boolean).join(' — ').slice(0, 400);
}

/** The home page of a site, to understand a page that says too little about itself. */
export function siteRoot(url: string): string | null {
  try {
    const u = new URL(url);
    const root = `${u.protocol}//${u.host}/`;
    return root === url || `${root}` === `${u.protocol}//${u.host}${u.pathname}` ? null : root;
  } catch {
    return null;
  }
}

/** A page completed with what its site's home page says: the deep page first, the home page as context. */
export function mergePages(page: PageInfo, root: PageInfo): PageInfo {
  return {
    ...page,
    description: page.description || root.description,
    siteName: page.siteName || root.siteName || root.title,
    keywords: page.keywords || root.keywords,
    headings: [...page.headings, ...root.headings].slice(0, 6),
    text: page.text || root.text,
    adult: page.adult || root.adult,
  };
}
