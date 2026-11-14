// End-to-end check of the interface in other languages: right to left in Arabic, other scripts, folder names in the
// language of the browser. Loads the built extension in Chrome with each language, sorts the fictitious collection
// (no site read, no history) and opens a folder.
// Usage: pnpm build && node tests/e2e/locales.mjs   (CHROME_PATH=/path/to/chrome, E2E_LANGS=ar,ja,hi,de, LOCALE_SHOTS=dir)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { corpus } from '../fixtures/corpus.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.join(ROOT, '.output', 'chrome-mv3');
const SHOTS = process.env.LOCALE_SHOTS;
const LANGS = (process.env.E2E_LANGS ?? 'ar,ja,hi,de').split(',');
const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`✓ ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

for (const lang of LANGS) {
  const code = lang.replace('-', '_');
  const messages = JSON.parse(fs.readFileSync(path.join(EXT, '_locales', code, 'messages.json'), 'utf8'));
  const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib', 'data', 'names', `${lang}.json`), 'utf8'));
  const msg = (key) => messages[key].message;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `nidomark-${lang}-`));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
    headless: true,
    enableExtensions: [EXT],
    userDataDir: profile,
    args: ['--no-first-run', '--disable-gpu', `--lang=${lang}`],
    pipe: true,
  });
  try {
    const sw = await (await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'))).worker();
    for (let i = 0; i < 50 && !(await sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.bookmarks)); i++) await sleep(200);
    await sw.evaluate(async (items) => {
      const folders = { Barre: '1', Autres: '2' };
      for (const [key, parentId, title] of [['Barre/Outils', '1', 'Outils'], ['Autres/Domotique', '2', 'Domotique'], ['Autres/Recettes', '2', 'Recettes'], ['Autres/À lire', '2', 'À lire'], ['Autres/Divers', '2', 'Divers'], ['Autres/Mariage 2025', '2', 'Mariage 2025']]) {
        folders[key] = (await chrome.bookmarks.create({ parentId, title })).id;
      }
      for (const b of items) await chrome.bookmarks.create({ parentId: folders[b.folder], title: b.title, url: b.url });
    }, corpus.map(({ folder, title, url }) => ({ folder, title, url })));

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`chrome-extension://${(new URL(sw.url())).host}/app.html`);
    await page.waitForSelector('[data-focus="analyze"]');
    await page.evaluate(() => document.fonts.ready);
    const html = await page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, title: document.querySelector('h1')?.textContent }));
    assert(html.lang === msg('lang') && html.title === msg('startTitle'), `${lang}: the interface speaks the browser's language (${html.title})`);
    assert(html.dir === (lang === 'ar' ? 'rtl' : 'ltr'), `${lang}: text runs ${html.dir}`);
    await page.click('[data-focus="more-options"]');
    await page.waitForSelector('#opt-read');
    for (const id of ['opt-read', 'opt-dead', 'opt-history']) if (await page.$eval(`#${id}`, (e) => e.checked)) await page.click(`#${id}`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-start.png`) });

    await page.click('[data-focus="analyze"]');
    await page.waitForSelector('.actionbar [data-focus="apply"], .center[role="alert"]', { timeout: 600000 });
    if (await page.$('.center[role="alert"]')) throw new Error(`${lang}: analysis failed: ${await page.$eval('.center[role="alert"]', (e) => e.textContent)}`);
    await sleep(900);
    const labels = await page.$$eval('.dests-label > span:first-child', (els) => els.map((e) => e.textContent));
    assert(labels.includes(msg('barFolder')) && labels.includes(msg('otherFolder')), `${lang}: root folders carry Chrome's names (${labels.slice(0, 2)})`);
    const tops = await page.$$eval('.dests .node-top .name', (els) => els.map((e) => e.textContent));
    assert(tops.includes(names['g:home']) && tops.includes(names.review), `${lang}: folders are named in the language (${tops.slice(0, 5).join(', ')}…)`);
    // In Arabic the source sits on the right and the connectors leave it towards the folders on the left.
    const side = await page.evaluate(() => {
      const src = document.querySelector('#source-node').getBoundingClientRect();
      const dest = document.querySelector('.dests .node-top').getBoundingClientRect();
      return src.left > dest.left ? 'right' : 'left';
    });
    assert(side === (lang === 'ar' ? 'right' : 'left'), `${lang}: the source is on the ${side}`);
    assert(await page.$$eval('.wires .wire', (w) => w.length) === tops.length, `${lang}: every folder at the top is wired`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-review.png`) });

    await page.click('.dests .node[data-key="review"] .node-main');
    await page.waitForSelector('.sheet .row .suggest');
    const overflow = await page.$$eval('.sheet .sheet-display label, .sheet .chip-action, .actionbar .btn', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    assert(overflow.length === 0, `${lang}: no label is cut (${overflow.join(' | ')})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-review-sheet.png`) });
    await page.keyboard.press('Escape');
    const home = await page.$eval('.dests .node-sub', (n) => n.dataset.key);
    await page.click(`.dests .node[data-key="${home}"] .node-main`);
    await page.waitForSelector('.sheet .sheet-display');
    const cut = await page.$$eval('.sheet .sheet-display label, .sheet .chip-action', (els) => els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    assert(cut.length === 0, `${lang}: the display choices and folder actions fit (${cut.join(' | ')})`);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${lang}-sheet.png`) });
    assert(errors.length === 0, `${lang}: no page error (${errors.join(' | ')})`);
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
}
console.log('LOCALES E2E OK');
