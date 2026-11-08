import './fixtures/psl';
import { describe, expect, it } from 'vitest';
import { type FetchLike, type FetchedResponse, extractPage, mergePages, pageText, readSite, readSites, siteRoot } from '../lib/site';

const html = (body: string, head = '') => `<!doctype html><html lang="fr"><head>${head}</head><body>${body}</body></html>`;

function respond(status: number, body = '', o: { url?: string; type?: string; delayMs?: number } = {}): FetchedResponse {
  const bytes = new TextEncoder().encode(body);
  return {
    status,
    url: o.url ?? '',
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? (o.type ?? 'text/html; charset=utf-8') : null) },
    body: new ReadableStream({ start(c) { c.enqueue(bytes); c.close(); } }),
  };
}

const opts = (fetch: FetchLike) => ({ timeoutMs: 200, maxBytes: 65536, fetch });

describe('extractPage', () => {
  it('reads title, description, site name, headings and text', () => {
    const p = extractPage(
      html(
        '<h1>Tarte aux pommes</h1><p>court</p><p>Une recette simple de tarte aux pommes, avec une pâte brisée maison et des pommes caramélisées.</p>',
        '<title>Tarte aux pommes &amp; cannelle | Mamie Cuisine</title><meta name="description" content="Recette facile de tarte aux pommes"><meta property="og:site_name" content="Mamie Cuisine"><meta property="og:type" content="article">',
      ),
      'https://mamie.example/tarte',
      200,
    );
    expect(p).toMatchObject({ title: 'Tarte aux pommes & cannelle | Mamie Cuisine', description: 'Recette facile de tarte aux pommes', siteName: 'Mamie Cuisine', ogType: 'article', lang: 'fr', headings: ['Tarte aux pommes'], adult: false });
    expect(p.text).toContain('pâte brisée');
    expect(pageText(p)).toContain('Recette facile');
  });

  it('ignores scripts and comments, and spots adult ratings', () => {
    const p = extractPage(html('<script>var t="<title>x</title>"</script><!-- <h1>hidden</h1> --><h2>Visible</h2>', '<meta name="rating" content="RTA-5042-1996-1400-1577-RTA">'), 'u', 200);
    expect(p.headings).toEqual(['Visible']);
    expect(p.adult).toBe(true);
  });
});

describe('readSite', () => {
  it('returns the page and the address after redirects', async () => {
    const v = await readSite('http://a.example/', opts(async () => respond(200, html('<h1>Bonjour</h1>', '<title>Accueil A</title>'), { url: 'https://a.example/fr/' })));
    expect(v).toMatchObject({ kind: 'ok', page: { title: 'Accueil A', url: 'https://a.example/fr/' } });
  });

  it('classifies dead pages', async () => {
    expect(await readSite('https://a.example/x', opts(async () => respond(404)))).toEqual({ kind: 'dead', reason: 'gone', status: 404 });
    expect(await readSite('https://a.example/x', opts(async () => respond(502)))).toEqual({ kind: 'dead', reason: 'server', status: 502 });
    expect(await readSite('https://a.example/', opts(async () => { throw new TypeError('Failed to fetch'); }))).toEqual({ kind: 'dead', reason: 'network' });
    expect(await readSite('https://a.example/', opts(() => new Promise(() => undefined)))).toEqual({ kind: 'dead', reason: 'timeout' });
  });

  it('treats refusals, bot checks and maintenance as alive', async () => {
    expect(await readSite('https://a.example/', opts(async () => respond(403)))).toEqual({ kind: 'blocked', status: 403 });
    expect(await readSite('https://a.example/', opts(async () => respond(429)))).toEqual({ kind: 'blocked', status: 429 });
    expect(await readSite('https://a.example/', opts(async () => respond(503, html('<h1>Just a moment...</h1>'))))).toEqual({ kind: 'blocked', status: 503 });
    expect(await readSite('https://a.example/', opts(async () => respond(503, html('<h1>Maintenance en cours</h1>'))))).toEqual({ kind: 'blocked', status: 503 });
  });

  it('reads a proxy error as a site that does not exist', async () => {
    expect(await readSite('http://gone.example/', opts(async () => respond(503, '<html><body>ERR_DNS_FAIL: Unable to determine IP address from host name</body></html>')))).toEqual({ kind: 'dead', reason: 'network', status: 503 });
    expect(await readSite('http://gone.example/', opts(async () => respond(407)))).toEqual({ kind: 'unknown' });
  });

  it('spots parked domains and default server pages', async () => {
    expect(await readSite('https://old.example/', opts(async () => respond(200, html('<h1>This domain is for sale!</h1>'))))).toMatchObject({ kind: 'dead', reason: 'parked' });
    expect(await readSite('https://old.example/', opts(async () => respond(200, html('<p>x</p>', '<title>Welcome to nginx!</title>'))))).toMatchObject({ kind: 'dead', reason: 'parked' });
    expect(await readSite('https://old.example/', opts(async () => respond(200, '', { url: 'https://www.hugedomains.com/domain_profile.cfm?d=old.example' })))).toMatchObject({ kind: 'dead', reason: 'parked' });
  });

  it('keeps non-HTML documents alive without reading them', async () => {
    expect(await readSite('https://a.example/doc.pdf', opts(async () => respond(200, '%PDF', { type: 'application/pdf' })))).toMatchObject({ kind: 'ok', page: { ogType: 'application/pdf' } });
  });

  it('decodes legacy charsets', async () => {
    const latin = new Uint8Array([...new TextEncoder().encode('<html><head><meta charset="windows-1252"><title>Caf'), 0xe9, ...new TextEncoder().encode('</title></head></html>')]);
    const res: FetchedResponse = { status: 200, url: '', headers: { get: () => 'text/html' }, body: new ReadableStream({ start(c) { c.enqueue(latin); c.close(); } }) };
    expect(await readSite('https://a.example/', opts(async () => res))).toMatchObject({ kind: 'ok', page: { title: 'Café' } });
  });

  it('never sends cookies or a referrer', async () => {
    let init: RequestInit | undefined;
    await readSite('https://a.example/', opts(async (_u, i) => { init = i; return respond(200, html('')); }));
    expect(init).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', method: 'GET' });
  });
});

describe('readSites', () => {
  const reqs = (n: number, host = (i: number) => `s${i}.example`) => Array.from({ length: n }, (_, i) => ({ id: String(i), url: `https://${host(i)}/`, maxBytes: 4096 }));
  const pool = { concurrency: 4, perHost: 2, timeoutMs: 200, retryTimeoutMs: 200 };

  it('respects the per-site and global limits', async () => {
    let active = 0;
    let peak = 0;
    const perHost = new Map<string, number>();
    let peakHost = 0;
    const fetch: FetchLike = async (u) => {
      const h = new URL(u).hostname;
      active++;
      perHost.set(h, (perHost.get(h) ?? 0) + 1);
      peak = Math.max(peak, active);
      peakHost = Math.max(peakHost, perHost.get(h) ?? 0);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      perHost.set(h, (perHost.get(h) ?? 1) - 1);
      return respond(200, html('<h1>ok</h1>'));
    };
    const res = await readSites(reqs(20, (i) => (i < 10 ? 'same.example' : `s${i}.example`)), { ...pool, fetch });
    expect(res.size).toBe(20);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peakHost).toBeLessThanOrEqual(2);
  });

  it('retries failures once before calling a site dead', async () => {
    const calls = new Map<string, number>();
    const fetch: FetchLike = async (u) => {
      calls.set(u, (calls.get(u) ?? 0) + 1);
      if (u.includes('s1.')) throw new TypeError('Failed to fetch');
      if (u.includes('s2.') && (calls.get(u) ?? 0) === 1) throw new TypeError('Failed to fetch');
      return respond(200, html('<h1>ok</h1>'));
    };
    const res = await readSites(reqs(30), { ...pool, fetch });
    expect(res.get('1')).toEqual({ kind: 'dead', reason: 'network' });
    expect(res.get('2')?.kind).toBe('ok');
    expect(calls.get('https://s1.example/')).toBe(2);
  });

  it('reports nothing dead when the computer is offline', async () => {
    const res = await readSites(reqs(40), { ...pool, fetch: async () => { throw new TypeError('Failed to fetch'); } });
    expect([...res.values()].every((v) => v.kind === 'unknown')).toBe(true);
  });
});

describe('site roots', () => {
  it('gives the home page of a deep link only', () => {
    expect(siteRoot('https://app.example.com/login?next=1')).toBe('https://app.example.com/');
    expect(siteRoot('https://app.example.com/')).toBeNull();
    expect(siteRoot('http://host.example:8080/a/b')).toBe('http://host.example:8080/');
  });

  it('completes a page with its home page', () => {
    const page = extractPage(html('', '<title>Connexion</title>'), 'u', 200);
    const root = extractPage(html('<h1>Gérez votre budget</h1>', '<title>Budgetly</title><meta name="description" content="Application de budget personnel">'), 'r', 200);
    expect(mergePages(page, root)).toMatchObject({ title: 'Connexion', description: 'Application de budget personnel', siteName: 'Budgetly', headings: ['Gérez votre budget'] });
  });
});
