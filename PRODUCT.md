# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who use Chrome on a computer and have accumulated dozens or hundreds of bookmarks left unsorted in "Other bookmarks", often mixing articles, tutorials, online tools and services hosted at home (home automation dashboard, NAS, media server). They want to find a bookmark again quickly without spending an evening filing them by hand.

## Product Purpose

Nidomark proposes, in one click, a clear folder tree for the user's bookmarks, computed by a small AI model that runs locally. The user checks the proposal, adjusts it, then applies it; the last sort can be undone in one click. Success: the user finds a bookmark where they would look for it, after very few corrections.

## Positioning

The classification runs entirely on the user's computer (no account, no server, nothing sent) and understands both what a page is about and what the user does with it: a Home Assistant dashboard and a tutorial about installing it share a subject but not a use, and the proposal follows the user's own folders to decide whether they belong together.

## Operating Context

A browser extension: a toolbar button opens a full-tab page in Chrome on desktop (Windows, macOS, Linux). Typical session: open, analyze (a few seconds to a minute), review the proposal, apply. The page follows the browser's light or dark theme. Interface in English and French.

## Capabilities and Constraints

- The whole collection is sorted by default, or the folders the user chooses; the shortcuts of the bookmarks bar stay in place. Folders that make sense are kept, catch-all folders are emptied, nothing is deleted.
- Nothing changes in the browser before the user applies; a sort never deletes a bookmark; a dated backup copy of the previous tree is made first; undo restores the same tree and never overwrites changes made since.
- Folders can carry an emoji before their name, only an emoji, or only a name, as the user prefers; bookmarks of the bookmarks bar can be shown as icons only.
- A dozen top-level folders hold precise categories (streaming, tech news, banking, adult content…); known sites and typical addresses are filed for sure, the local model files the rest, and the page is read when the title is not enough.
- Sites that no longer answer are set apart; every bookmark left to check has been tested and can be opened from the list.
- Duplicates are removed (one copy stays, the backup keeps the others).
- Bookmarks without enough clues are listed "to check" with a short reason instead of being filed.
- Optional permissions: access to sites, to read the bookmarked pages themselves (no cookies, nothing sent); browsing history, to understand vague titles from the real page titles.
- No data leaves the computer, and the interface says so.
- Chrome first (Manifest V3, Chrome Web Store), Firefox and Edge later.
- Planned next: targeted history cleanup, then a password-protected vault.

## Brand Commitments

- Name: Nidomark. Icon: white bookmark ribbon on a teal rounded tile with an amber sparkle.
- Visual direction requested by the user: faithful to Google's product style (Material 3: clean, light or dark like the browser, rounded corners, one accent colour, Google typography), simple, uncluttered and very intuitive.
- Main screen requested by the user: a simplified n8n-like node view, where the unsorted bookmarks are linked by curves to the proposed folders, a folder opens its bookmarks in a side panel, and a bookmark can be dragged to another folder.

## Evidence on Hand

- A fictitious collection of 41 bookmarks used by the tests and screenshots (`tests/fixtures/corpus.js`); it is synthetic and must be labelled as such when shown.
- No users, testimonials, ratings or store listing exist yet; none may be invented.

## Product Principles

- Nothing happens behind the user's back: show the result before writing it, and make every change reversible.
- Private by construction: everything runs on the user's computer.
- The proposal follows the user's own folders and words before inventing new ones.
- Few, clear decisions: the user should understand the proposal at a glance and correct it in a few gestures.

## Accessibility & Inclusion

Every action, including moving a bookmark between folders, must be possible with the keyboard and announced to screen readers; drag and drop is a shortcut, never the only way.
