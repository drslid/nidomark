# Privacy policy

Nidomark organizes your bookmarks on your own computer. It has no account, no server and no analytics: no data leaves your computer.

## What the extension reads

- **Bookmarks** (`bookmarks` permission): titles, addresses and folders, to build the proposal and apply the changes you approve.
- **Site icons** (`favicon` permission, Chrome only): the icons already cached by the browser, to display them in the review screen.
- **Bookmarked pages** (access to sites, optional): only if "Read sites when the title is not enough" or "Find sites that no longer answer" is on. Chrome asks for this access once, at the first analysis; you can refuse it, turn both options off, or revoke it at any time in `chrome://extensions`.
- **Page titles from your browsing history** (`history` permission, optional): only if you enable "Use history for vague titles". You can revoke it at any time in the extension's settings or in `chrome://extensions`.

## How pages are read

When the title and address of a bookmark are not enough to file it, or to check whether a site still answers, Nidomark requests **the bookmarked address itself**, exactly as your browser would open it:

- without cookies and without a referrer, so you are not signed in and the site does not learn where the request comes from;
- only the beginning of the page is read (its title, description, headings and first paragraphs), never stored;
- addresses of your local network (NAS, box, home server) and services hosted at home are never requested;
- when a page says too little about itself, the home page of the same site may be read as well;
- nothing about your bookmarks or your collection is sent anywhere: the only network traffic is the page request, the same one a visit would make. The site sees your IP address, as it would during a visit.

## What the extension stores

Everything is stored locally, in the extension's storage on your computer:

- your settings;
- the journal of the last sort, used to undo it;
- the original names of bookmarks shown as icon only, to show them again;
- the folders you chose instead of the proposal, used to improve the next proposals;
- the folders Nidomark created, to recognise them at the next sort;
- the list of the backups it made;
- a cache of the numbers (vectors) computed by the model for each bookmark text.

When the backup option is on, a copy of the previous tree is created **among your bookmarks** ("Nidomark backup – date" in Other bookmarks), before anything moves. If you use Chrome sync, this copy is synced like any bookmark. Delete it from the settings, or from the bookmarks manager, when you no longer need it.

When "Remove duplicates" is on, copies of a page that is kept elsewhere are deleted from your bookmarks after the backup is made; the backup still holds them, and undoing the sort puts them back.

"Clear the analysis cache" in the settings deletes the cache. Removing the extension deletes all of its data (the backup folders, being bookmarks, stay until you delete them).

## What the extension sends

Nothing. The model and its runtime are packaged with the extension and run offline. Apart from the page requests described above, which you can turn off, the extension makes no network request. It does not sell or share data and does not use it for any purpose other than organizing your bookmarks.

## Contact

Open an issue on [GitHub](https://github.com/drslid/nidomark/issues).
