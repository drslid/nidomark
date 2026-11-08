// End-to-end test of site reading in Chrome: a local server plays a few sites, the extension reads them in
// parallel, files what the pages say, sets dead sites apart and tests every bookmark left to check.
// Usage: pnpm build && node tests/e2e/sites.mjs   (CHROME_PATH=/path/to/chrome)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILT = path.join(ROOT, '.output', 'chrome-mv3');
const EXT = path.join(ROOT, '.output', 'e2e-sites-ext');
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`✓ ${msg}`);
};

// The built extension, with access to sites and to the history granted up front: no permission prompt in a
// headless browser.
// Hard links keep the copy instant; the manifest is rewritten as a file of its own.
fs.rmSync(EXT, { recursive: true, force: true });
execFileSync('cp', ['-al', BUILT, EXT]);
const manifestPath = path.join(EXT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
fs.unlinkSync(manifestPath);
manifest.host_permissions = ['http://*/*', 'https://*/*'];
manifest.permissions = [...new Set([...(manifest.permissions ?? []), 'history'])];
fs.writeFileSync(manifestPath, JSON.stringify(manifest));

const page = (title, description, body = '') =>
  `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>${description ? `<meta name="description" content="${description}">` : ''}</head><body>${body}</body></html>`;

const SITES = {
  'cinema-hub.example': { '/': [200, page('Cinema Hub – films et séries en streaming VF', 'Regardez gratuitement les derniers films et séries en streaming HD, en VF et VOSTFR, sans inscription.', '<h1>Nouveaux films</h1><h2>Séries populaires</h2>')] },
  'mamie-tartes.example': {
    '/compte/connexion': [200, page('Connexion', '', '<form><input name="login"></form>')],
    '/': [200, page('Mamie Tartes', 'Des recettes de tartes sucrées et salées, de desserts et de gâteaux, faciles et testées en famille.', '<h1>Nos recettes de tartes</h1><h2>Tarte aux pommes</h2>')],
  },
  'ma-veille-mobile.example': { '/': [200, page('Accueil', 'Tests de smartphones Android et iPhone, actualité high-tech, comparatifs et bons plans tech.', '<h1>Les derniers tests</h1>')] },
  'vieux-blog.example': {},
  'domaine-a-vendre.example': { '/': [200, page('domaine-a-vendre.example', '', '<h1>This domain is for sale!</h1><p>Make an offer today.</p>')] },
  'protege.example': { '/': [503, page('Just a moment...', '', '<h1>Checking your browser before accessing the site.</h1>')] },
};
const BOOKMARKS = [
  { id: 'stream', title: 'Accueil', url: 'http://cinema-hub.example/' },
  { id: 'tartes', title: 'Mon compte', url: 'http://mamie-tartes.example/compte/connexion' },
  { id: 'tech', title: 'Accueil', url: 'http://ma-veille-mobile.example/' },
  { id: 'gone', title: 'Un vieil article', url: 'http://vieux-blog.example/2014/05/article' },
  { id: 'parked', title: 'Mon ancien site', url: 'http://domaine-a-vendre.example/' },
  { id: 'nowhere', title: 'Site disparu', url: 'http://nidomark-test-nulle-part.invalid/' },
  { id: 'protected', title: 'Accueil', url: 'http://protege.example/' },
];

let active = 0;
let peak = 0;
const seen = [];
const server = http.createServer((req, res) => {
  const host = (req.headers.host ?? '').split(':')[0];
  seen.push({ host, path: req.url, cookie: req.headers.cookie, referer: req.headers.referer });
  active++;
  peak = Math.max(peak, active);
  setTimeout(() => {
    active--;
    const [status, body] = SITES[host]?.[req.url] ?? [404, page('Page introuvable', '')];
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' });
    res.end(body);
  }, 300);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nidomark-sites-'));
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  enableExtensions: [EXT],
  userDataDir: profile,
  args: ['--no-first-run', '--disable-gpu', '--lang=fr', '--no-proxy-server', `--host-resolver-rules=MAP *.example 127.0.0.1:${port}`],
  pipe: true,
});

try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().startsWith('chrome-extension://'), { timeout: 60000 });
  const sw = await swTarget.worker();
  const extId = new URL(swTarget.url()).host;
  for (let i = 0; i < 50 && !(await sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.bookmarks)); i++) await new Promise((r) => setTimeout(r, 200));
  const ids = await sw.evaluate(async (items) => {
    const out = {};
    for (const b of items) out[b.id] = (await chrome.bookmarks.create({ parentId: '2', title: b.title, url: b.url })).id;
    return out;
  }, BOOKMARKS);

  const tab = await browser.newPage();
  await tab.setViewport({ width: 1280, height: 800 });
  const errors = [];
  tab.on('pageerror', (e) => errors.push(e.message));
  await tab.goto(`chrome-extension://${extId}/app.html`);
  await tab.waitForSelector('[data-focus="analyze"]');
  await tab.click('[data-focus="analyze"]');
  await tab.waitForSelector('.actionbar [data-focus="apply"], .center[role="alert"]', { timeout: 300000 });
  if (await tab.$('.center[role="alert"]')) throw new Error(`analysis failed: ${await tab.$eval('.center[role="alert"]', (e) => e.textContent)}`);

  // Where each bookmark goes: open every node and read its rows, under their subfolder when they have one.
  const where = {};
  for (const key of await tab.$$eval('.dests .node', (els) => els.map((n) => n.dataset.key))) {
    await tab.click(`.dests .node[data-key="${key}"]`);
    await tab.waitForSelector('.sheet');
    const name = await tab.$eval(`.dests .node[data-key="${key}"] .name span`, (e) => e.textContent);
    const rows = await tab.$$eval('.sheet .row', (els) => els.map((r) => ({ id: r.dataset.id, section: r.closest('.sec')?.getAttribute('aria-label') ?? null, why: r.querySelector('.why')?.textContent ?? '' })));
    for (const row of rows) where[row.id] = { name: row.section ?? name, key, why: row.why };
    await tab.keyboard.press('Escape');
  }
  const at = (id) => where[ids[id]] ?? {};
  console.log(JSON.stringify(Object.fromEntries(BOOKMARKS.map((b) => [b.id, at(b.id)]))));

  assert(at('stream').name === 'Streaming', 'a vague bookmark whose page talks about streaming goes to Streaming');
  assert(at('tech').name === 'Actu tech', 'a tech news site with a vague title goes to Tech news');
  assert(at('tartes').name === 'Cuisine', 'a login page is understood from the home page of its site');
  assert(['gone', 'parked', 'nowhere'].every((id) => at(id).name === 'Sites inaccessibles'), 'removed pages, domains for sale and missing domains are set apart');
  assert(at('protected').key === 'review' && /refuse/.test(at('protected').why), 'a site behind a bot check is left to check, with the reason');
  assert(seen.some((r) => r.host === 'mamie-tartes.example' && r.path === '/'), 'the home page of an unclear page is read');
  assert(seen.every((r) => !r.cookie && !r.referer), 'no cookie and no referrer are sent');
  assert(peak >= 2 && peak <= 16, `sites are read in parallel, within limits (peak ${peak})`);

  // Bookmarks to check can be opened from the sheet.
  await tab.click('.dests .node[data-key="review"]');
  await tab.waitForSelector('.sheet .row a.icon-btn');
  assert((await tab.$eval('.sheet .row a.icon-btn', (a) => a.getAttribute('href'))) === 'http://protege.example/', 'a bookmark to check can be opened in a new tab');
  assert(errors.length === 0, `no page error (${errors.join(' | ')})`);
  console.log('SITES E2E OK');
} finally {
  await browser.close();
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });
  fs.rmSync(EXT, { recursive: true, force: true });
}
