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
| `pnpm e2e` | End-to-end test in Chrome: real analysis, apply, undo (`CHROME_PATH` to override the browser) |
| `pnpm eval` | Prints how the classifier files the fictitious collection (`--detail` lists the differences with the reference) |
| `pnpm fixtures` | Recomputes the test vectors with the packaged model, after changing how texts are built |
| `pnpm icons` | Regenerates the icons from `scripts/make-icons.mjs` |

`scripts/eval-grid.ts` (grid search of the classifier options) and `scripts/eval-pairs.ts` (similarity between bookmarks that belong together) help tuning; run them with `pnpm exec jiti scripts/<name>.ts`.

## How a proposal is built

1. **Snapshot** of the bookmarks tree (`lib/snapshot.ts`).
2. **Features** for each bookmark (`lib/features.ts`): host, port, path words, private or remote-access host, known self-hosted application, vague title, cleaned title and use signals. With the optional history permission, a vague title is replaced by the real page title stored by the browser.
3. **Texts and embeddings** (`lib/pipeline.ts`, `lib/embed.worker.ts`): only the bookmarks to organize and up to 40 bookmarks per destination folder are embedded, with the usage descriptions and the folder-name vocabulary. Vectors are cached in IndexedDB.
4. **Similarity** (`lib/classify.ts`) between two bookmarks combines the model's similarity, shared keywords (TF-IDF) and their *subject profiles* (how strongly each subject of the vocabulary stands out). The sum is standardised against the collection, so thresholds read as "standard deviations above average" whatever the model.
5. **Decisions**, in this order: not enough evidence → "to check"; bookmarks you filed yourself; home services; guides about self-hosted apps; existing subject folders when both subject and use fit; average-linkage groups of three bookmarks or more, named after the closest subject (never after a kind of page such as "Tools"); finally usage folders ("Tools", "Read later") only for bookmarks whose use is clearly established. The rest stays where it is.
6. **Plan** (`lib/plan.ts`): folders are created, bookmarks moved, then renamed. Nothing is deleted. The journal is written before each operation; undo runs in reverse and skips anything changed since.

The unit tests replay this pipeline on the fictitious collection of the feasibility study, with vectors computed by the packaged model (`tests/fixtures/e5-pipeline-vectors.json`), with and without history and in both languages. The default options come from `scripts/eval-grid.ts`: 24 of 31 bookmarks are filed as in the hand-made reference in all four configurations. They are tuned on 41 bookmarks only and must be checked on real collections.

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
