import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    short_name: '__MSG_extShortName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    // "favicon" exposes the browser's favicon cache to extension pages (Chrome only).
    permissions: browser === 'firefox' ? ['bookmarks', 'storage'] : ['bookmarks', 'storage', 'favicon'],
    optional_permissions: ['history'],
    // Asked for at the first analysis, only to read the bookmarked pages themselves (no cookies, nothing sent).
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    action: { default_title: '__MSG_actionTitle__' },
    // WebAssembly is needed by ONNX Runtime; all code is packaged, nothing is loaded remotely.
    content_security_policy: { extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';" },
    minimum_chrome_version: '116',
  }),
  vite: () => ({
    worker: { format: 'es' },
    plugins: [
      {
        // ONNX Runtime references its .wasm with `new URL(..., import.meta.url)`, which makes Vite emit a hashed copy.
        // The extension loads the copy in /ort/ (see scripts/fetch-model.mjs), so drop the duplicate (27 MB).
        name: 'drop-duplicate-ort-wasm',
        generateBundle(_options: unknown, bundle: Record<string, unknown>) {
          for (const file of Object.keys(bundle)) if (/ort-wasm.*\.wasm$/.test(file)) delete bundle[file];
        },
      },
    ],
  }),
});
