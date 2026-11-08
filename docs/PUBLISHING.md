# Publishing

## Chrome Web Store

### One-time setup

1. Register a developer account in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole): accept the developer agreement and pay the one-time registration fee ([documentation](https://developer.chrome.com/docs/webstore/register)). Use an email address you check often; it cannot be changed later.
2. Publish this repository's [privacy policy](PRIVACY.md) at a public URL (the GitHub page of the file works).

### Each release

1. Update `version` in `package.json`.
2. `pnpm install && pnpm fetch-model && pnpm check && pnpm zip`.
3. Run `pnpm e2e` on the build.
4. Upload `.output/nidomark-<version>-chrome.zip` in the dashboard.

The package is about 163 MB unpacked (89 MB zipped); the limit is 2 GB ([documentation](https://developer.chrome.com/docs/webstore/publish)).

### Store listing

| Field | English | Français |
| --- | --- | --- |
| Summary | A small local AI tidies your bookmarks into clear folders, with emoji and icon-only bar items. Private, offline, free. | Une petite IA locale range vos favoris dans des dossiers clairs, avec emoji et barre en icônes. Privé, hors ligne, gratuit. |
| Category | Productivity | Productivité |

Description (English):

> Nidomark proposes a clear folder tree for your bookmarks and applies it only after you review it.
> A small multilingual AI runs inside your browser: your bookmarks never leave your computer, there is no account and no server.
> • Understands what each bookmark is about and what you use it for: home services, online tools, tutorials, articles, news.
> • Reuses your folders, creates new ones only when several bookmarks belong together, and explains each move.
> • Emoji folder names, icon-only bookmarks bar with a preview, cleaner titles.
> • Review everything side by side; nothing changes until you apply, and one click undoes the last sort.

Description (français) :

> Nidomark propose une arborescence claire pour vos favoris et ne l'applique qu'après votre vérification.
> Une petite IA multilingue fonctionne dans votre navigateur : vos favoris ne quittent jamais votre ordinateur, sans compte ni serveur.
> • Comprend de quoi parle chaque favori et à quoi il vous sert : services maison, outils en ligne, tutoriels, articles, actualités.
> • Réutilise vos dossiers, n'en crée que lorsque plusieurs favoris vont ensemble, et explique chaque déplacement.
> • Dossiers avec emoji, barre de favoris en icônes avec aperçu, titres plus clairs.
> • Vérifiez tout côte à côte : rien ne change avant d'appliquer, et un clic annule le dernier tri.

Images ([requirements](https://developer.chrome.com/docs/webstore/images)):

- Icon: `public/icon/128.png` (96 px artwork with 16 px transparent padding).
- Screenshots: 1 to 5 images of 1280×800, square corners. `pnpm e2e` writes them to `.output/screenshots/store-*.png` (`E2E_LANG=en` for English), labelled "Fictional sample collection" because they show the test collection; the current set is in [`docs/store`](store).

### Privacy practices tab

- **Single purpose:** organize the user's bookmarks into folders.
- **`bookmarks`:** read the bookmarks to build the proposal; create folders, move and rename bookmarks after the user approves.
- **`storage`:** keep the settings, the undo journal and the original names of icon-only bookmarks.
- **`favicon`:** show site icons in the review screen and the bookmarks bar preview.
- **`history` (optional):** read page titles already stored by the browser to understand vague bookmark titles, only when the user enables it.
- **Host permissions `http://*/*`, `https://*/*` (optional, requested at the first analysis):** request the bookmarked pages themselves, without cookies, to read their title and description when the bookmark title is not enough, and to find bookmarks whose site no longer answers. No other request is made; nothing is sent.
- **Remote code:** no. The model and the WebAssembly runtime are packaged with the extension.
- **Data usage:** no user data is collected or transmitted.

## Firefox (next)

WXT builds Firefox with `pnpm build:firefox` and `pnpm zip:firefox`, which also creates the sources zip required by addons.mozilla.org. Changes needed before submitting:

- add `browser_specific_settings.gecko.id` to the manifest;
- replace the `favicon` permission (Chrome only): the code already falls back to letter badges;
- check the bookmarks toolbar rendering of empty titles and the root folder ids (`toolbar_____`, `unfiled_____`, already handled by `lib/snapshot.ts`);
- run the end-to-end test against Firefox.

## Edge (next)

Edge accepts the Chrome package: submit the same zip in Microsoft Partner Center. `wxt submit` can automate Chrome, Firefox and Edge submissions once the listings exist ([WXT publishing guide](https://wxt.dev/guide/essentials/publishing.html)).
