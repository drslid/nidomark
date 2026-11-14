// End-to-end test: loads the built extension in Chrome, creates the fictitious collection (synthetic data),
// runs a real analysis with the packaged model, corrects the proposal with the menu and with drag and drop,
// rebuilds the tree, then undoes it.
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
    for (const [key, parentId, title] of [['Barre/Outils', '1', 'Outils'], ['Autres/Domotique', '2', 'Domotique'], ['Autres/Recettes', '2', 'Recettes'], ['Autres/À lire', '2', 'À lire'], ['Autres/Divers', '2', 'Divers'], ['Autres/Mariage 2025', '2', 'Mariage 2025']]) {
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
    // No hover highlight left where the last click happened.
    await page.mouse.move(2, 790);
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
  // The whole tree is chosen by default, the shortcuts of the bookmarks bar included.
  const analyzeLabel = await page.$eval('[data-focus="analyze"]', (b) => b.textContent);
  assert(/50/.test(analyzeLabel), `every bookmark is covered, bar shortcuts included (${analyzeLabel})`);
  assert(await page.$('.archive-note'), 'the start screen says the current tree is kept in a backup');
  // No site is read and the history is not used in this test: no permission prompt, no network.
  await page.click('[data-focus="more-options"]');
  await page.waitForSelector('#opt-read');
  for (const id of ['opt-read', 'opt-dead', 'opt-history']) if (await page.$eval(`#${id}`, (e) => e.checked)) await page.click(`#${id}`);
  await sleep(200);
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
  assert(/47/.test(initialApply), `every page is filed once, duplicates aside (${initialApply})`);

  const nodes = () => page.$$eval('.dests .node-top', (els) => els.map((n) => ({ key: n.dataset.key, name: n.querySelector('.name')?.textContent ?? '', count: Number(n.dataset.count) })));
  const allNodes = () => page.$$eval('.dests .node', (els) => els.map((n) => ({ key: n.dataset.key, name: n.querySelector('.name')?.textContent ?? '', count: Number(n.dataset.count) })));
  const applyCount = async () => Number((await applyText()).replace(/\D/g, ''));
  const menuClick = (re) => page.evaluate((src) => [...document.querySelectorAll('.menu button')].find((b) => new RegExp(src).test(b.textContent.trim()))?.click(), re.source);
  const dragOnto = (fromSel, toSel) => page.evaluate((a, b) => {
    const src = document.querySelector(a);
    const dst = document.querySelector(b);
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const lit = document.querySelectorAll('.board.drag-active .dests .node.can-drop').length;
    dst.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    dst.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return lit;
  }, fromSel, toSel);
  const initial = await nodes();
  console.log('nodes:', JSON.stringify(initial));
  const named = (list, re) => list.find((n) => re.test(n.name));
  assert(initial[0]?.key === 'bar' && initial[0].count === 3, 'quick access keeps the shortcuts of the bar, first');
  assert((named(initial, /^(Maison|Home)$/)?.count ?? 0) >= 12, 'home services, home automation and recipes share the Home folder');
  assert((named(initial, /^(Voyages|Travel)$/)?.count ?? 0) >= 3, 'trip bookmarks get a travel folder');
  assert(initial.some((n) => n.key === 'review'), 'bookmarks without enough clues wait in To check');
  assert(initial.some((n) => n.key === 'dupes' && n.count === 3), 'the three duplicates are listed apart');
  assert(initial.every((n) => n.key !== 'stay'), 'nothing stays where it was');
  const labels = await page.$$eval('.dests-label > span:first-child', (els) => els.map((e) => e.textContent));
  assert(labels.includes(LANG === 'fr' ? 'Barre de favoris' : 'Bookmarks bar') && labels.includes(LANG === 'fr' ? 'Autres favoris' : 'Other bookmarks'), `folders are shown where they will be created (${labels})`);
  assert(await page.$$eval('.wires .wire', (w) => w.length) === initial.length, 'every folder at the top is wired to the source');
  const box = async (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; });
  assert((await box('.dests > :last-child')).bottom <= (await box('.actionbar')).top || (await page.$eval('.canvas-wrap', (e) => e.scrollHeight > e.clientHeight)), 'the action bar never covers the canvas');
  const strip = await page.$$eval('.barstrip .items > *', (els) => els.map((e) => (e.classList.contains('chip-folder') ? `folder:${e.textContent}` : `icon:${e.getAttribute('aria-pressed')}`)));
  assert(strip.slice(0, 3).every((x) => x === 'icon:true') && strip.slice(3).every((x) => x.startsWith('folder:')), `the new bar is previewed: icons first, then folders (${strip})`);

  // Subfolders sit under their folder on the canvas, each with its own sheet.
  const home = named(initial, /^(Maison|Home)$/);
  const homeKids = await page.$$eval(`.dests .node[data-key="${home.key}"] + .children > .branch > .node`, (els) => els.map((n) => n.querySelector('.name')?.textContent));
  assert(homeKids.length >= 3 && homeKids.includes('Domotique'), `subfolders show on the canvas, under their folder (${homeKids})`);
  const domo = named(await allNodes(), /^Domotique$/);
  await page.click(`.dests .node[data-key="${domo.key}"]`);
  await page.waitForSelector('.sheet .row');
  assert((await page.$$eval('.sheet .row .title', (els) => els.map((e) => e.textContent))).some((x) => /Home Assistant/.test(x)), 'the Home Assistant video joins Domotique');
  assert(/›/.test(await page.$eval('.sheet .sheet-path', (e) => e.textContent)), 'the sheet says where the folder is');
  await sleep(300);
  await storeShot('store-3-sheet');

  // Deleting a folder: its bookmarks move up to the folder above, nothing is left out, and it can be undone.
  const recipes = named(await allNodes(), /^(Recettes|Cooking)$/);
  await page.click(`.dests .node[data-key="${recipes.key}"]`);
  await page.waitForSelector('[data-focus="tool-delete"]');
  await page.click('[data-focus="tool-delete"]');
  await page.waitForSelector('dialog[open] input[value="keep"]:checked');
  await page.click('dialog[open] .btn-filled');
  await sleep(200);
  assert(!(await allNodes()).some((n) => n.key === recipes.key), 'a deleted folder leaves the canvas');
  assert((await nodes()).find((n) => n.key === home.key)?.count === home.count, 'its bookmarks move up into the folder above');
  assert((await applyText()) === initialApply, 'deleting a folder files the same bookmarks');
  await page.click('.snackbar [data-focus="snack-undo"]');
  await sleep(200);
  assert((await allNodes()).some((n) => n.key === recipes.key), 'the snackbar undoes the deletion');
  await page.keyboard.press('Escape');
  await sleep(100);

  // Open the travel folder, move one bookmark to quick access with the keyboard menu.
  const travel = named(initial, /^(Voyages|Travel)$/);
  await page.click(`.dests .node[data-key="${travel.key}"]`);
  await page.waitForSelector('.sheet .row');
  assert(await page.$eval('.sheet [data-focus="sheet-close"]', (b) => b === document.activeElement), 'focus moves into the side sheet');
  const firstRow = await page.$eval('.sheet .row', (r) => r.dataset.id);
  await page.focus(`[data-focus="more-${firstRow}"]`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.menu button');
  await menuClick(/^(Déplacer vers|Move to)…$/);
  await page.waitForSelector('.menu button.nested');
  const menuItems = await page.$$eval('.menu button', (b) => b.map((x) => x.textContent));
  assert(menuItems.some((x) => /Accès rapide|Quick access/.test(x)) && menuItems.some((x) => /Domotique/.test(x)), 'the move menu follows the new tree, subfolders and quick access included');
  await menuClick(/^(Accès rapide|Quick access)$/);
  await sleep(200);
  const afterMenu = await nodes();
  assert(afterMenu.find((n) => n.key === travel.key).count === travel.count - 1 && afterMenu.find((n) => n.key === 'bar').count === 4, 'moving with the menu updates the counts');
  assert(/déplacé|moved/.test(await page.$eval('#live', (e) => e.textContent ?? '')), 'the move is announced to screen readers');

  // Rename a bookmark in place, then remove it: it waits in Removed, and comes back.
  const renameId = await page.$eval('.sheet .row', (r) => r.dataset.id);
  await page.click(`.sheet .row[data-id="${renameId}"] .title`, { clickCount: 2 });
  await page.waitForSelector(`[data-focus="rename-${renameId}"]`);
  await page.keyboard.type('Billets de train');
  await page.keyboard.press('Enter');
  await sleep(150);
  assert((await page.$eval(`.sheet .row[data-id="${renameId}"] .title`, (e) => e.textContent)) === 'Billets de train', 'a bookmark is renamed in place');
  const beforeRemove = await applyCount();
  await page.click(`[data-focus="more-${renameId}"]`);
  await page.waitForSelector('.menu button');
  await menuClick(/^(Supprimer|Remove)$/);
  await sleep(150);
  assert((await nodes()).find((n) => n.key === 'removed')?.count === 1 && (await applyCount()) === beforeRemove - 1, 'a removed bookmark is not recreated and waits in Removed');
  await page.click('.dests .node[data-key="removed"]');
  await page.waitForSelector('[data-focus="sheet-restore-all"]');
  await page.click('[data-focus="sheet-restore-all"]');
  await sleep(150);
  assert(!(await nodes()).some((n) => n.key === 'removed') && (await applyCount()) === beforeRemove, 'a removed bookmark can be restored');

  // Drag a bookmark of the travel sheet onto the Home folder.
  await page.click(`.dests .node[data-key="${travel.key}"]`);
  await page.waitForSelector('.sheet .row');
  const dragId = await page.$eval('.sheet .row', (r) => r.dataset.id);
  const lit = await dragOnto(`.sheet .row[data-id="${dragId}"]`, `.dests .node[data-key="${home.key}"]`);
  await sleep(200);
  assert(lit >= 3, `every folder that can take a dragged bookmark lights up (${lit})`);
  assert(!(await page.$('.board.drag-active, .drop-target, .can-drop')), 'the drag highlight is cleared after the drop');
  const afterDrop = await nodes();
  assert(afterDrop.find((n) => n.key === home.key).count === home.count + 1, 'dropping a bookmark on a folder moves it there');

  // Select all in a folder, move the selection at once, undo it in one go; then drag a selection.
  const services = named(await allNodes(), /^(Services maison|Home services)$/);
  await page.click(`.dests .node[data-key="${services.key}"]`);
  await page.waitForSelector('[data-focus="select-all"]');
  const inServices = await page.$$eval('.sheet .row', (r) => r.length);
  const travelBefore = afterDrop.find((n) => n.key === travel.key).count;
  const checkState = () => page.$eval('[data-focus="select-all"]', (b) => b.getAttribute('aria-checked'));
  await page.click('[data-focus="select-all"]');
  await sleep(150);
  assert(inServices >= 4 && (await page.$$eval('.sheet .row.checked', (r) => r.length)) === inServices && (await checkState()) === 'true', `Select all checks every bookmark of the folder (${inServices})`);
  const firstPick = await page.$eval('.sheet .row', (r) => r.dataset.id);
  await page.click(`[data-focus="pick-${firstPick}"]`);
  await sleep(150);
  assert((await checkState()) === 'mixed' && (await page.$$eval('.sheet .row.checked', (r) => r.length)) === inServices - 1, 'unchecking one bookmark leaves Select all half-checked');
  if (REVIEW) {
    // A clean picture for the guide: no message of the previous change, no pointer over a row.
    await page.evaluate(() => document.querySelector('.snackbar .snack-close')?.click());
    await page.mouse.move(2, 790);
    await sleep(250);
    await page.screenshot({ path: path.join(REVIEW, `desktop-select${DARK ? '-dark' : ''}.png`) });
  }
  await page.click('[data-focus="sel-move"]');
  await page.waitForSelector('.menu button.nested');
  await menuClick(/(Voyages|Travel)$/);
  await sleep(200);
  assert((await nodes()).find((n) => n.key === travel.key).count === travelBefore + inServices - 1 && (await page.$$eval('.sheet .row', (r) => r.length)) === 1, 'the checked bookmarks move together');
  assert(/déplacés|moved/i.test(await page.$eval('.snackbar', (e) => e.textContent ?? '')), 'the group move is confirmed once');
  await page.click('.snackbar [data-focus="snack-undo"]');
  await sleep(200);
  assert((await nodes()).find((n) => n.key === travel.key).count === travelBefore && (await page.$$eval('.sheet .row', (r) => r.length)) === inServices, 'one undo brings the whole group back');
  const [pickA, pickB] = await page.$$eval('.sheet .row', (rows) => rows.slice(0, 2).map((r) => r.dataset.id));
  await page.click(`[data-focus="pick-${pickA}"]`);
  await page.click(`[data-focus="pick-${pickB}"]`);
  await sleep(150);
  await dragOnto(`.sheet .row[data-id="${pickB}"]`, `.dests .node[data-key="${travel.key}"]`);
  await sleep(200);
  assert((await nodes()).find((n) => n.key === travel.key).count === travelBefore + 2, 'dragging a checked bookmark carries the others checked');
  await page.click('.snackbar [data-focus="snack-undo"]');
  await sleep(200);
  assert((await nodes()).find((n) => n.key === travel.key).count === travelBefore && !(await page.$('.sheet .row.checked')), 'undo restores the group and clears the selection');
  // A selection serves one change: moving another bookmark from its own menu clears it.
  const [pickC, pickD, third] = await page.$$eval('.sheet .row', (rows) => rows.slice(0, 3).map((r) => r.dataset.id));
  await page.click(`[data-focus="pick-${pickC}"]`);
  await page.click(`[data-focus="pick-${pickD}"]`);
  await page.click(`[data-focus="more-${third}"]`);
  await page.waitForSelector('.menu button');
  await menuClick(/^(Déplacer vers|Move to)…$/);
  await page.waitForSelector('.menu button.nested');
  await menuClick(/(Voyages|Travel)$/);
  await sleep(200);
  assert(!(await page.$('.sheet .row.checked')) && (await checkState()) === 'false', 'any other change clears the selection');
  await page.click('.snackbar [data-focus="snack-undo"]');
  await sleep(200);
  await page.keyboard.press('Escape');
  await sleep(100);
  assert(!(await page.$('.sheet')), 'Escape closes the side sheet');

  // A folder of one's own, then a folder dragged into it; a folder never goes inside itself; Ctrl+Z undoes.
  await page.click('[data-focus="add-folder"]');
  await page.waitForSelector('dialog[open] #new-folder-name');
  await page.type('#new-folder-name', 'Projets');
  await page.select('#new-folder-place', 'root:2');
  await page.click('dialog[open] .btn-filled');
  await sleep(200);
  const projets = named(await nodes(), /^Projets$/);
  assert(projets && (await page.$eval('.sheet .name-field', (e) => e.value)) === 'Projets', 'a new folder shows on the canvas, its sheet open');
  await dragOnto(`.dests .node[data-key="${travel.key}"]`, `.dests .node[data-key="${projets.key}"]`);
  await sleep(200);
  const inside = await page.$$eval(`.dests .node[data-key="${projets.key}"] + .children .node`, (els) => els.map((n) => n.dataset.key));
  assert(inside.includes(travel.key) && !(await nodes()).some((n) => n.key === travel.key), 'a folder dragged onto another goes inside it');
  await dragOnto(`.dests .node[data-key="${projets.key}"]`, `.dests .node[data-key="${travel.key}"]`);
  await sleep(200);
  assert((await nodes()).some((n) => n.key === projets.key), 'a folder never goes inside one of its subfolders');
  await page.evaluate(() => document.activeElement?.blur());
  await page.keyboard.down('Control');
  await page.keyboard.press('z');
  await page.keyboard.up('Control');
  await sleep(200);
  assert((await nodes()).some((n) => n.key === travel.key), 'Ctrl+Z undoes the last change');

  // A folder can show its name instead of its emoji in the bar.
  await page.click(`.dests .node[data-key="${home.key}"]`);
  await page.waitForSelector('.sheet .sheet-display');
  await page.click(`label:has([data-focus="style-${home.key.slice(2)}-name"])`);
  await sleep(150);
  assert((await page.$$eval('.barstrip .chip-folder', (els) => els.map((e) => e.textContent))).includes(home.name), 'a folder shows its own name in the bar when chosen');
  await page.keyboard.press('Escape');
  await sleep(100);

  // Bookmarks to check say why and get suggestions; one click files one, another files them all.
  const review = afterDrop.find((n) => n.key === 'review');
  await page.click('.dests .node[data-key="review"]');
  await page.waitForSelector('.sheet .row');
  assert(await page.$$eval('.sheet .row', (rows) => rows.every((r) => r.querySelector('.why')?.textContent)), 'each bookmark to check says why');
  assert(await page.$$eval('.sheet .row', (rows) => rows.every((r) => r.querySelector('.suggest'))), 'each bookmark to check gets suggestions');
  await page.click('.sheet .suggest');
  await sleep(150);
  assert(((await nodes()).find((n) => n.key === 'review')?.count ?? 0) === review.count - 1, 'a suggestion files the bookmark in one click');
  if (REVIEW) await page.screenshot({ path: path.join(REVIEW, `desktop-review-sheet${DARK ? '-dark' : ''}.png`) });
  await page.click('[data-focus="tool-accept"]');
  await sleep(150);
  assert(!(await nodes()).some((n) => n.key === 'review'), 'all suggestions are accepted in one click');
  await page.keyboard.press('Escape');
  await sleep(100);

  // Bring the proposal back: the screen returns to its first state.
  await page.click('.actionbar [data-focus="restore"]');
  await sleep(150);
  assert((await applyText()) === initialApply, 'restoring the proposal brings every decision back');
  assert(JSON.stringify(await nodes()) === JSON.stringify(initial), 'restoring the proposal restores every folder');
  await page.click('.snackbar .snack-close');
  await page.evaluate(() => document.activeElement?.blur());

  if (REVIEW) {
    await page.setViewport({ width: 1440, height: 900 });
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop${DARK ? '-dark' : ''}.png`) });
    await page.click(`.dests .node[data-key="${domo.key}"]`);
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop-sheet${DARK ? '-dark' : ''}.png`) });
    // A bookmark held over the travel folder: every folder that can take it lights up.
    await page.evaluate((key) => {
      const row = document.querySelector('.sheet .row');
      const target = document.querySelector(`.dests .node[data-key="${key}"]`);
      const dt = new DataTransfer();
      row.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      window.__endDrag = () => row.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    }, travel.key);
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `desktop-drag${DARK ? '-dark' : ''}.png`) });
    await page.evaluate(() => window.__endDrag());
    await page.keyboard.press('Escape');
    await page.setViewport({ width: 390, height: 844 });
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `mobile${DARK ? '-dark' : ''}.png`), fullPage: true });
    await page.setViewport({ width: 1280, height: 800 });
    await sleep(300);
  }

  console.log('action bar:', await page.$eval('.actionbar', (e) => e.textContent));
  await page.click('.actionbar [data-focus="apply"]');
  await page.waitForSelector('[data-focus="undo"]', { timeout: 120000 });
  await storeShot('store-4-done');
  const doneText = await page.$eval('main', (e) => e.textContent);
  assert(doneText.includes('47'), 'the done screen reports the 47 bookmarks announced before applying');
  const after = await snapshot();
  assert(after !== before, 'the bookmarks changed after applying');
  const other = await sw.evaluate(async () => (await chrome.bookmarks.getChildren('2')).map((n) => n.title));
  console.log('other bookmarks:', JSON.stringify(other));
  assert(/^Nidomark (– sauvegarde du|backup –) /.test(other.at(-1) ?? ''), 'the previous tree is archived, last in Other bookmarks');
  assert(other.some((x) => /^❓ (À vérifier|To check)$/.test(x)), 'bookmarks to check are in Other bookmarks, under their full name');
  const urls = await sw.evaluate(async () => {
    const out = [];
    const walk = (n, inArchive) => {
      const archive = inArchive || /^Nidomark (– sauvegarde|backup)/.test(n.title ?? '');
      if (n.url) out.push([n.url, archive]);
      (n.children ?? []).forEach((c) => walk(c, archive));
    };
    (await chrome.bookmarks.getTree()).forEach((n) => walk(n, false));
    return out;
  });
  const live = urls.filter(([, a]) => !a).map(([u]) => u);
  const archived = urls.filter(([, a]) => a).map(([u]) => u);
  assert(live.length === 47 && new Set(live).size === 47, `every page is in the new tree once (${live.length})`);
  assert(!live.includes('https://netflix.com/browse/') && !live.includes('http://lemonde.fr/'), 'duplicates are not recreated');
  assert(archived.length === 50 && archived.includes('https://netflix.com/browse/'), 'the archive keeps every bookmark, duplicates included');
  const bar = await sw.evaluate(async () => (await chrome.bookmarks.getChildren('1')).map((n) => ({ title: n.title, folder: !n.url })));
  console.log('bookmarks bar:', JSON.stringify(bar));
  assert(bar.slice(0, 3).every((n) => n.title === '' && !n.folder), 'the bar starts with quick access icons');
  assert(bar.some((n) => n.folder && n.title === '🏠') && bar.some((n) => n.folder && n.title === '💻'), 'new folders sit in the bar, named with an emoji only');
  const tech = await sw.evaluate(async () => {
    const [folder] = (await chrome.bookmarks.getChildren('1')).filter((n) => n.title === '💻');
    return folder ? (await chrome.bookmarks.getChildren(folder.id)).map((n) => n.title) : [];
  });
  assert(tech.some((x) => /Développement|Development/.test(x)), `subfolders keep their names (${JSON.stringify(tech)})`);
  if (REVIEW) {
    await page.click('[data-focus="settings"]');
    await page.waitForSelector('.settings');
    await sleep(300);
    await page.screenshot({ path: path.join(REVIEW, `settings${DARK ? '-dark' : ''}.png`), fullPage: true });
    await page.click('[data-focus="back"]');
    await page.waitForSelector('[data-focus="again"]');
  }

  // Sorting the new tree again proposes the same tree: the folders of the first sort are recognised, the archive
  // and the bookmarks to check are not mixed in, and the icons of quick access keep their names.
  await page.click('[data-focus="again"]');
  await page.waitForSelector('[data-focus="analyze"]');
  const againLabel = await page.$eval('[data-focus="analyze"]', (b) => b.textContent);
  assert(/47/.test(againLabel), `a second sort covers the new tree, not the archive (${againLabel})`);
  await page.click('[data-focus="analyze"]');
  await page.waitForSelector('.actionbar [data-focus="apply"], .center[role="alert"]', { timeout: 600000 });
  if (await page.$('.center[role="alert"]')) throw new Error(`second analysis failed: ${await page.$eval('.center[role="alert"]', (e) => e.textContent)}`);
  const tree = (list) => list.filter((n) => n.key !== 'dupes').map((n) => `${n.name}:${n.count}`);
  const second = await nodes();
  assert(JSON.stringify(tree(second)) === JSON.stringify(tree(initial)), `a second sort proposes the same tree (${tree(second)})`);
  await page.click('.dests .node[data-key="bar"]');
  await page.waitForSelector('.sheet .row');
  const quickNames = await page.$$eval('.sheet .row .title', (els) => els.map((e) => e.textContent));
  assert(quickNames.every((x) => x && !/sans nom|untitled/i.test(x)), `icons keep their names (${quickNames})`);
  await page.keyboard.press('Escape');
  await sleep(100);
  // Leaving the review asks first; the last sort can then be undone from the start screen.
  await page.click('[data-focus="back"]');
  await page.waitForSelector('dialog[open]');
  await page.click('dialog[open] .btn-filled');
  await page.waitForSelector('.banner [data-focus="undo"]');

  await page.click('[data-focus="undo"]');
  await page.waitForSelector('[data-focus="again"]', { timeout: 120000 });
  assert((await snapshot()) === before, 'undo restores exactly the same tree: same bookmarks, ids, positions and dates');
  assert(errors.length === 0, `no page error (${errors.join(' | ')})`);
  console.log('E2E OK');
} finally {
  await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
