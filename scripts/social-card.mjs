// Renders the social card of the documentation site (1200×630, website/public/images/social-card.png) from the
// brand mark, the extension's font and the review screenshot. Run after changing one of them:
// node scripts/social-card.mjs   (CHROME_PATH=/path/to/chrome)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'website', 'public', 'images', 'social-card.png');
const url = (p) => pathToFileURL(path.join(ROOT, p)).href;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'Google Sans'; font-weight: 400 700; src: url('${url('public/fonts/GoogleSans-latin.woff2')}') format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; background: #eff5f3; color: #171d1c; font-family: 'Google Sans', sans-serif; }
  .copy { position: absolute; left: 72px; top: 72px; width: 470px; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 34px; line-height: 40px; }
  .brand img { width: 56px; height: 56px; }
  h1 { margin-top: 64px; font-size: 54px; line-height: 62px; font-weight: 400; letter-spacing: -0.01em; text-wrap: balance; }
  p { margin-top: 24px; font-size: 24px; line-height: 34px; color: #3f4947; text-wrap: pretty; }
  .shot { position: absolute; left: 584px; top: 96px; width: 760px; border-radius: 20px; overflow: hidden; background: #ffffff;
    box-shadow: 0 4px 8px 3px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.25); }
  .shot img { display: block; width: 100%; }
</style></head>
<body>
  <div class="copy">
    <div class="brand"><img src="${url('website/src/assets/brand-mark.svg')}" alt=""><span>Nidomark</span></div>
    <h1>Your bookmarks, sorted on your computer</h1>
    <p>A small AI in your browser recreates every bookmark in clear folders, your favourite sites first.</p>
  </div>
  <div class="shot"><img src="${url('docs/assets/review.png')}" alt=""></div>
</body></html>`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nidomark-card-'));
const page = path.join(tmp, 'card.html');
fs.writeFileSync(page, html);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-first-run', '--allow-file-access-from-files'] });
try {
  const tab = await browser.newPage();
  await tab.setViewport({ width: 1200, height: 630 });
  await tab.goto(pathToFileURL(page).href, { waitUntil: 'load' });
  await tab.evaluate(() => document.fonts.ready);
  const font = await tab.evaluate(() => document.fonts.check("54px 'Google Sans'"));
  if (!font) throw new Error('Google Sans did not load');
  await tab.screenshot({ path: OUT });
  console.log(`${path.relative(ROOT, OUT)} written`);
} finally {
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
