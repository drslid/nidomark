// End-to-end test: loads the built extension in Chrome, creates the fictitious collection (synthetic data),
// runs a real analysis with the packaged model, corrects the proposal with the menu and with drag and drop,
// applies it, then undoes it.
// Usage: pnpm build && node tests/e2e/smoke.mjs   (CHROME_PATH=/path/to/chrome, E2E_LANG=fr|en, SCREENSHOTS=dir, REVIEW_SHOTS=dir)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { corpus } from '../fixtures/corpus.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXT = path.join(ROOT, '.output', 'chrome-mv3');
const SHOTS = process.env.SCREENSHOTS ?? path.join(ROOT, '.output', 'screenshots');
const REVIEW = process.env.REVIEW_SHOTS;
const LANG = process.env.E2E_LANG ?? 'fr';
const DARK = process.env.E2E_DARK === '1';
// Store screenshots show the fictitious test collection, so they say so (PRODUCT.md).
const SAMPLE_LABEL = LANG === 'fr' ? 'Collection d’exemple fictive' : 'Fictional sample collection';
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nidomark-e2e-'));
fs.mkdirSync(SHOTS, { recursive: true });
if (REVIEW) fs.mkdirSync(REVIEW, { recursive: true });
const suffix = `${LANG}${DARK ? '-dark' : ''}`;

const assert = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`✓ ${msg}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  enableExtensions: [EXT],
  userDataDir: profile,
  args: ['--no-first-run', '--disable-gpu', `--lang=${LANG}`],
  pipe: true,
});

try {
  const swTarget = await browser.waitForTarget((t) => t.type() === 'service_worker' && t.url().endsWith('/background.js'));
  const sw = await swTarget.worker();
  const extId = new URL(swTarget.url()).host;
  for (let i = 0; i < 50 && !(await sw.evaluate(() => typeof chrome !== 'undefined' && !!chrome.bookmarks)); i++) await sleep(200);

  await sw.evaluate(async (items) => {
    const folders = { Barre: '1', Autres: '2' };
    for (const [key, parentId, title] of [['Barre/Outils', '1', 'Outils'], ['Autres/Domotique', '2', 'Domotique'], ['Autres/Recettes', '2', 'Recettes'], ['Autres/À lire', '2', 'À lire']]) {
      folders[key] = (await chrome.bookmarks.create({ parentId, title })).id;
    }
    for (const b of items) await chrome.bookmarks.create({ parentId: folders[b.folder], title: b.title, url: b.url });
  }, corpus.map(({ folder, title, url }) => ({ folder, title, url })));
  const snapshot = () => sw.evaluate(async () => {
    const out = [];
    const walk = (n) => { out.push([n.id, n.parentId, n.index, n.title, n.url ?? '', n.dateAdded]); (n.children ?? []).forEach(walk); };
    (await chrome.bookmarks.getTree()).forEach(walk);
    return JSON.stringify(out.sort((a, b) => a[0].localeCompare(b[0])));
  });
  const before = await snapshot();

  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: DARK ? 'dark' : 'light' }]);
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`chrome-extension://${extId}/app.html`);
  await page.waitForSelector('[data-focus="analyze"]');
  await page.evaluate(() => document.fonts.ready);
  const storeShot = async (name) => {
    await page.evaluate((text) => {
      const el = document.createElement('div');
      el.id = 'e2e-sample';
      el.textContent = text;
      el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:100;padding:1px 10px;border:1px dashed var(--outline);border-radius:8px;background:var(--surface-low);color:var(--on-surface-variant);font:500 12px/20px var(--font);pointer-events:none';
      document.body.append(el);
    }, SAMPLE_LABEL);
    await page.screenshot({ path: path.join(SHOTS, `${name}-${suffix}.png`) });
    await page.evaluate(() => document.getElementById('e2e-sample')?.remove());
  };
  await storeShot('store-1-start');
  if (REVIEW) {
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(REVIEW, `mobile-start${DARK ? '-dark' : ''}.png`), fullPage: true });
    await page.setViewport({ width: 1280, height: 800 });
  }

  const t0 = Date.now();
  await page.click('[data-focus="analyze"]');
  await page.waitForSelector('.actionbar [data-focus="apply"], [role="alert"]', { timeout: 600000 });
  if (await page.$('.center[role="alert"]')) throw new Error(`analysis failed: ${await page.$eval('.center[role="alert"]', (e) => e.textContent)}`);
  console.log(`analysis: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await sleep(900);
  await storeShot('store-2-review');
  const applyText = () => page.$eval('.actionbar [data-focus="apply"]', (b) => b.textContent);
  const initialApply = await applyText();
  assert(/\d/.test(initialApply), 'the apply button carries the number of changes');

  const nodes = () => page.$$eval('.dests .node', (els) => els.map((n) => ({ key: n.dataset.key, name: n.querySelector('.name span')?.textContent ?? '', count: Number(n.dataset.count) })));
  const initial = await nodes();
  console.log('nodes:', JSON.stringify(initial));
  assert(initial.some((n) => /Services maison|Home services/.test(n.name) && n.count >= 5), 'home services are grouped');
  assert(initial.some((n) => /^(Voyages|Travel)$/.test(n.name) && n.count >= 3), 'trip bookmarks get a travel folder');
  assert(initial.some((n) => n.name === 'Domotique'), 'the Home Assistant video joins Domotique');
  assert(await page.$$eval('.wires .wire', (w) => w.length) === initial.filter((n) => n.count >= 0).length, 'every node is wired to the source');
  const box = async (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  assert((await box('.dests > :last-child')).bottom <= (await box('.actionbar')).top || (await page.$eval('.canvas-wrap', (e) => e.scrollHeight > e.clientHeight)), 'the action bar never covers the canvas');

  // Store screenshot of the largest proposed folder, then close it.
  await page.click(`.dests .node[data-key="${initial[0].key}"]`);
  await page.waitForSelector('.sheet .row');
  await sleep(300);
  await storeShot('store-3-sheet');
  await page.keyboard.press('Escape');
  await sleep(100);

  // Open the travel folder, move one bookmark with the keyboard menu.
  const travel = initial.find((n) => /^(Voyages|Travel)$/.test(n.name));
  await page.click(`.dests .node[data-key="${travel.key}"]`);
  await page.waitForSelector('.sheet .row');
  assert(await page.$eval('.sheet [data-focus="sheet-close"]', (b) => b === document.activeElement), 'focus moves into the side sheet');
  const firstRow = await page.$eval('.sheet .row', (r) => r.dataset.id);
  await page.focus(`[data-focus="mv-${firstRow}"]`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.menu button');
  const menuItems = await page.$$eval('.menu button', (b) => b.map((x) => x.textContent));
  assert(menuItems.some((x) => /Laisser à sa place|Keep in place/.test(x)), 'the move menu offers to keep the bookmark in place');
  await page.evaluate(() => [...document.querySelectorAll('.menu button')].find((b) => /Laisser à sa place|Keep in place/.test(b.textContent))?.click());
  await sleep(200);
  const afterMenu = await nodes();
  assert(afterMenu.find((n) => n.key === travel.key).count === travel.count - 1, 'moving with the menu updates the counts');
  assert(/déplacé|moved|reste|stays/.test(await page.$eval('#live', (e) => e.textContent ?? '')), 'the move is announced to screen readers');

  // Drag the next bookmark of the sheet onto "Domotique".
  const domotique = afterMenu.find((n) => n.name === 'Domotique');
  const dragId = await page.$eval('.sheet .row', (r) => r.dataset.id);
  const lit = await page.evaluate((id, key) => {
    const row = document.querySelector(`.sheet .row[data-id="${id}"]`);
    const target = document.querySelector(`.dests .node[data-key="${key}"]`);
    const dt = new DataTransfer();
    row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const eligible = document.querySelectorAll('.board.drag-active .dests .node.droppable:not(.origin)').length;
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return eligible;
  }, dragId, domotique.key);
  await sleep(200);
  assert(lit >= 3, `every folder that can take a dragged bookmark lights up (${lit})`);
  assert(!(await page.$('.board.drag-active, .node.origin, .node.drop-target')), 'the drag highlight is cleared after the drop');
  const afterDrop = await nodes();
  assert(afterDrop.find((n) => n.key === domotique.key).count === domotique.count + 1, 'dropping a bookmark on a folder moves it there');
  await page.keyboard.press('Escape');
  await sleep(100);
  assert(!(await page.$('.sheet')), 'Escape closes the side sheet');

  // Reject everything, then bring the proposal back: the screen returns to its first state.
  await page.click('.actionbar [data-focus="reject-all"]');
  await sleep(150);
  assert(await page.$eval('.actionbar [data-focus="apply"]', (b) => b.disabled), 'rejecting all leaves nothing to apply');
  await page.click('.actionbar [data-focus="restore"]');
  await sleep(150);
  assert((await applyText()) === initialApply, 'restoring the proposal brings every change back');
  assert(JSON.stringify(await nodes()) === JSON.stringify(initial), 'restoring the proposal restores every folder');
  await page.click('.dests .node[data-key="review"]');
  await page.waitForSelector('.sheet .row');
  assert(await page.$$eval('.sheet .row', (rows) => rows.every((r) => r.querySelector('.why')?.textContent)), 'each bookmark to check says why');
  await page.keyboard.press('Escape');
  await sleep(100);
  await page.evaluate(() => document.activeElement?.blur());

  if (REVIEW) {
    await page.setViewport({ width: 1440, height: 900 });
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop${DARK ? '-dark' : ''}.png`) });
    await page.click(`.dests .node[data-key="${initial[0].key}"]`);
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop-sheet${DARK ? '-dark' : ''}.png`) });
    // A bookmark held over "Domotique": every folder that can take it lights up.
    await page.evaluate(() => {
      const row = document.querySelector('.sheet .row');
      const target = [...document.querySelectorAll('.dests .node')].find((n) => n.querySelector('.name span')?.textContent === 'Domotique');
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      window.__endDrag = () => row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    });
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop-drag${DARK ? '-dark' : ''}.png`) });
    await page.evaluate(() => window.__endDrag());
    await page.click('.dests .node[data-key="review"]');
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop-review-sheet${DARK ? '-dark' : ''}.png`) });
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 390, height: 844 });
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `mobile${DARK ? '-dark' : ''}.png`), fullPage: true });
    await page.setViewport({ width: 1280, height: 800 });
    await sleep(300);
  }

  const applyLabel = await page.$eval('.actionbar', (e) => e.textContent);
  console.log('action bar:', applyLabel);
  await page.click('.actionbar [data-focus="apply"]');
  await page.waitForSelector('[data-focus="undo"]', { timeout: 120000 });
  await storeShot('store-4-done');
  const doneText = await page.$eval('main', (e) => e.textContent);
  const applied = initialApply.match(/\d+/)?.[0];
  assert(doneText.includes(applied), `the done screen reports the ${applied} changes announced before applying`);
  const after = await snapshot();
  assert(after !== before, 'the bookmarks changed after applying');
  const titles = await sw.evaluate(async () => (await chrome.bookmarks.getChildren('2')).map((n) => n.title));
  console.log('other bookmarks:', JSON.stringify(titles));
  assert(titles.some((x) => /^\S+ Services maison$|^\S+ Home services$/u.test(x)), 'new folders carry an emoji');
  const bar = await sw.evaluate(async () => (await chrome.bookmarks.getChildren('1')).map((n) => n.title));
  assert(bar.includes(''), 'bar bookmarks are shown as icons only');

  await page.click('[data-focus="undo"]');
  await page.waitForSelector('[data-focus="again"]', { timeout: 120000 });
  assert((await snapshot()) === before, 'undo restores the exact same tree');
  assert(errors.length === 0, `no page error (${errors.join(' | ')})`);
  console.log('E2E OK');
} finally {
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
