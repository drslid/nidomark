# Privacy policy

Nidomark organizes your bookmarks on your own computer. It has no account, no server and no analytics.

## What the extension reads

- **Bookmarks** (`bookmarks` permission): titles, addresses and folders, to build the proposal and apply the changes you approve.
- **Site icons** (`favicon` permission, Chrome only): the icons already cached by the browser, to display them in the review screen.
- **Page titles from your browsing history** (`history` permission, optional): only if you enable "Use my browsing history to understand vague titles". You can revoke it at any time in the extension's settings or in `chrome://extensions`.

## What the extension stores

Everything is stored locally, in the extension's storage on your computer:

- your settings;
- the journal of the last sort, used to undo it;
- the original names of bookmarks shown as icon only, to show them again;
- the folders you chose instead of the proposal, used to improve the next proposals;
- a cache of the numbers (vectors) computed by the model for each bookmark text.

"Clear the analysis cache" in the settings deletes the cache. Removing the extension deletes all of its data.

## What the extension sends

Nothing. The model and its runtime are packaged with the extension and run offline. The extension makes no network request, does not sell or share data and does not use it for any purpose other than organizing your bookmarks.

## Contact

Open an issue on [GitHub](https://github.com/drslid/nidomark/issues).
