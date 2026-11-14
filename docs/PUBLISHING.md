# Publishing

## Chrome Web Store

### One-time setup

1. Register a developer account in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole): accept the developer agreement and pay the one-time registration fee ([documentation](https://developer.chrome.com/docs/webstore/register)). Use an email address you check often; it cannot be changed later.
2. Use the privacy policy published at <https://drslid.github.io/Nidomark/reference/privacy/> (source: [PRIVACY.md](PRIVACY.md)).

### Each release

1. Update `version` in `package.json`.
2. `pnpm install && pnpm fetch-model && pnpm check && pnpm zip`.
3. Run `pnpm e2e` on the build.
4. Upload `.output/nidomark-<version>-chrome.zip` in the dashboard.

The package is about 163 MB unpacked (89 MB zipped); the limit is 2 GB ([documentation](https://developer.chrome.com/docs/webstore/publish)).

### Store listing

| Field | English | Français |
| --- | --- | --- |
| Summary | A small local AI recreates all your bookmarks in clear folders, your most visited sites first. Private, offline, free. | Une petite IA locale recrée tous vos favoris dans des dossiers clairs, vos sites préférés en tête. Privé, hors ligne, gratuit. |
| Category | Productivity | Productivité |

Description (English):

> Nidomark rebuilds your bookmarks into a clear tree and applies it only after you review it.
> A small multilingual AI runs inside your browser: your bookmarks never leave your computer, there is no account and no server.
> • Understands what each bookmark is about and what you use it for: home services, online tools, tutorials, articles, news, streaming.
> • Files every bookmark: your most visited sites as icons at the start of the bar, then a dozen folders, three levels at most.
> • Keeps your folders that make sense, sets dead links, duplicates and adult content apart, and explains each choice.
> • Lets you change everything before applying: drag bookmarks and folders, create, rename or delete folders, show a folder as an emoji or a name, and undo any change.
> • Suggests a folder for every bookmark it is unsure of, and analyzes a folder again when you ask.
> • Your previous tree is kept as it was in a dated backup; one click undoes the sort.
> • In 21 languages, chosen from your browser's.

Description (français) :

> Nidomark reconstruit vos favoris en une arborescence claire et ne l'applique qu'après votre vérification.
> Une petite IA multilingue fonctionne dans votre navigateur : vos favoris ne quittent jamais votre ordinateur, sans compte ni serveur.
> • Comprend de quoi parle chaque favori et à quoi il vous sert : services maison, outils en ligne, tutoriels, articles, actualités, streaming.
> • Range tous vos favoris : vos sites les plus visités en icônes au début de la barre, puis une douzaine de dossiers, trois niveaux au plus.
> • Garde vos dossiers qui ont du sens, met à part les liens morts, les doublons et les contenus adultes, et explique chaque choix.
> • Vous laisse tout modifier avant d'appliquer : glissez favoris et dossiers, créez, renommez ou supprimez des dossiers, affichez un dossier en emoji ou en nom, et annulez chaque changement.
> • Propose un dossier pour chaque favori incertain, et réanalyse un dossier à la demande.
> • Votre ancienne arborescence est gardée telle quelle dans une sauvegarde datée ; un clic annule le tri.
> • En 21 langues, choisie d'après celle de votre navigateur.

The extension's name and summary come from `_locales/<code>/messages.json` (`extName`, `extDescription`) in each of the 21 languages; the dashboard takes the detailed description and the screenshots per language, English and French at least.

Images ([requirements](https://developer.chrome.com/docs/webstore/images)):

- Icon: `public/icon/128.png` (96 px artwork with 16 px transparent padding).
- Screenshots: 1 to 5 images of 1280×800, square corners. `pnpm e2e` writes them to `.output/screenshots/store-*.png` (`E2E_LANG=en` for English), labelled "Fictional sample collection" because they show the test collection; the current set is in [`docs/store`](store).

### Privacy practices tab

- **Single purpose:** organize the user's bookmarks into folders.
- **`bookmarks`:** read the bookmarks to build the proposal; after the user approves, create the new folders and bookmarks, and move the previous tree into a backup folder.
- **`storage`:** keep the settings, the undo journal and the original names of icon-only bookmarks.
- **`favicon`:** show site icons in the review screen and the bookmarks bar preview.
- **`history` (optional, requested at the first analysis while "Put the most visited sites first" is on):** count the visits of each bookmarked site to put the most used ones first, and read page titles already stored by the browser to understand vague bookmark titles. Read locally, never stored or sent.
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
