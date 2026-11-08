# Development

## Requirements

- Node.js 22 or later and pnpm (`corepack enable` installs the version pinned in `package.json`).
- Chrome 116 or later to load the extension.

## First build

```bash
pnpm install
pnpm fetch-model
pnpm build
```

`pnpm fetch-model` downloads `Xenova/multilingual-e5-small` at a pinned revision, checks the SHA-256 (large files) and git blob hashes (small files) published by Hugging Face, and copies the ONNX Runtime WebAssembly files from `node_modules` into `public/ort`. These files are not committed: the model is larger than GitHub's 100 MB file limit.

Load `.output/chrome-mv3` from `chrome://extensions` → **Developer mode** → **Load unpacked**. After a rebuild, click the reload button of the extension.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development build with hot reload in a new Chrome window |
| `pnpm check` | Type check and unit tests |
| `pnpm build` | Production build in `.output/chrome-mv3` |
| `pnpm zip` | Zip for the Chrome Web Store |
| `pnpm e2e` | End-to-end tests in Chrome: real analysis, apply, undo, duplicates, then site reading against a local server (`CHROME_PATH` to override the browser) |
| `pnpm eval` | Prints how the classifier files the fictitious collection (`--detail` lists the differences with the reference) |
| `pnpm fixtures` | Recomputes the test vectors with the packaged model, after changing how texts are built |
| `pnpm examples` | Recomputes the vectors of the category examples (`lib/data/examples.ts`) |
| `pnpm icons` | Regenerates the icons from `scripts/make-icons.mjs` |

`scripts/eval-grid.ts` (grid search of the categorizer options) helps tuning; run it with `pnpm exec jiti scripts/eval-grid.ts`. `pnpm eval --pages --detail` prints where each bookmark goes and why.

## How a proposal is built

1. **Scope** (`lib/categorize.ts`, `scopeCandidates`): every web bookmark inside the chosen folders, the whole tree by default. The nearest chosen ancestor decides, so a subfolder can be left out. The shortcuts placed directly in the bookmarks bar and Nidomark's backup folders are never sorted. **Duplicates** (`lib/duplicates.ts`) are copies of the same page (scheme, `www.`, trailing slash and tracking parameters ignored, fragment kept); a copy outside the sort is always kept, otherwise the copy with the most telling title.
2. **Features** for each bookmark (`lib/features.ts`): host, port, path words, private or remote-access host, known self-hosted application, vague title, cleaned title and use signals. With the optional history permission, a vague title is replaced by the real page title stored by the browser.
3. **Embeddings** (`lib/pipeline.ts`, `lib/embed.worker.ts`): the bookmarks to sort, the usage descriptions, the category descriptions and the folder names. The typical bookmarks of each category (`lib/data/examples.ts`) are embedded in advance (`lib/data/example-vectors.ts`). Vectors are cached in IndexedDB.
4. **Rules first** (`lib/taxonomy.ts`): an address only reachable at home, a dead site (when sites are checked), adult content (known site, address, explicit title, rating meta tag), more than 1,000 known sites and hosts, typical addresses (`.gouv.fr`, regional banks, school portals, webmail), and pages about self-hosted applications.
5. **The model** for the rest: the nearest labelled bookmarks (the built-in examples and the bookmarks of this collection recognised by a rule) vote, weighted by their closeness; the similarity to the category description and the keywords found add to it. A category is chosen when it leads the second by a margin; otherwise the bookmark is "unclear".
6. **Pages** (`lib/site.ts`): when allowed, unclear bookmarks are read (16 at a time, 2 per site, no cookies, 128 KB at most) and scored again on the page text; every bookmark can also be checked for dead sites (16 KB). 404 and 410 mean removed, parking pages and default server pages mean abandoned; bot checks (403 or 503 with a challenge) and maintenance pages mean alive. Failures are retried once; if nearly everything fails the computer is considered offline and nothing is reported dead. Then every bookmark still to check is tested: read if it was not, and when its page says too little (under 40 characters), the home page of its site is read and merged with it.
7. **Folders**: the user's folders are recognised by name (categories, groups, catch-alls, folders organised by use such as "Tools" or "Read later") or kept when their bookmarks belong together ("Wedding 2025"). Bookmarks already in the right place stay. The others go to an existing folder of their category or group, else to a new group folder with a subfolder per category (from two bookmarks), or to a folder named after the category when it is the only one of its group. Adult content and dead links go to Other bookmarks.
8. **Plan** (`lib/plan.ts`): a dated backup copy of the sorted folders first, then folders are created, bookmarks moved, duplicates removed, then renamed. Nothing else is deleted. The backup is one journal entry; moves, removals and renames are journaled by batches of 50 written before the changes, in an order that keeps the recorded positions exact; undo runs in reverse, recreates removed duplicates at their place, skips anything changed since, and removes the backup if nobody touched it.

The unit tests replay this pipeline on the fictitious collection of the feasibility study (47 bookmarks), with vectors computed by the packaged model (`tests/fixtures/e5-pipeline-vectors.json`), with and without history, pages and in both languages. With pages, all 46 bookmarks the hand-made reference covers land where expected (3 of them are duplicates); without pages, the 3 the title cannot explain are left "to check". `tests/e2e/sites.mjs` checks site reading in Chrome against a local server: pages, home pages, dead and parked sites, bot checks, no cookies, parallel requests. The default options come from `scripts/eval-grid.ts`. They are tuned on a small collection and must be checked on real ones.

## Project layout

```text
entrypoints/app/        Organizer page (index.html, main.ts, style.css)
entrypoints/background.ts
lib/                    Logic, without UI
lib/ui/                 Views built with a small h() helper: review.ts (canvas, connectors),
                        sheet.ts (side sheet, menus, emoji picker), views.ts, settings.ts
lib/data/               Public Suffix List (MPL-2.0)
public/_locales/        Messages; "{1}" placeholders are replaced by lib/i18n.ts
public/fonts/           Google Sans (OFL-1.1), latin and latin-ext subsets
scripts/                fetch-model.mjs, make-icons.mjs, fixture-vectors.ts and evaluation tools
tests/                  Vitest unit tests, fixtures (collection, model vectors) and tests/e2e/smoke.mjs
```

## Conventions

- TypeScript strict mode, no UI framework, no runtime dependency besides Transformers.js.
- Every user-facing string goes through `t()` and exists in English and French.
- Colours, radii and elevation come from the Material 3 tokens at the top of `entrypoints/app/style.css`; [DESIGN.md](../DESIGN.md) describes the system.
- Interactive elements carry a `data-focus` key so that re-rendering keeps keyboard focus.
