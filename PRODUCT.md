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

A browser extension: a toolbar button opens a full-tab page in Chrome on desktop (Windows, macOS, Linux). Typical session: open, analyze (a few seconds to a minute), review the proposal, apply. The page follows the browser's light or dark theme. Interface in 21 languages, chosen from the browser's (Arabic right to left).

## Capabilities and Constraints

- Every bookmark of the chosen folders (the whole collection by default, the bar's shortcuts included) is recreated in a new tree; nothing stays where it was. The previous tree is moved, untouched, into a dated backup in Other bookmarks; nothing is deleted.
- The new tree: quick access icons of the most visited sites at the start of the bookmarks bar, then about a dozen top-level folders (the most used first) holding precise categories, three levels at most. Folders of the user that make sense are recreated, catch-all folders are emptied. Adult content, dead sites, bookmarks to check and browser links go to Other bookmarks, never to the bar.
- Nothing changes in the browser before the user applies; undo puts every original back, with the same ids and dates, and never overwrites changes made since.
- Folders can carry an emoji before their name, only an emoji, or only a name, as the user prefers, folder by folder; quick access shows icons only, names can be shown again. Chrome always shows a bookmark's icon and shows the address of an unnamed bookmark inside a folder: a bookmark can be "icon only" in the bar only, never "text only".
- Before applying, everything can be changed: folders at every level are moved, made, renamed or deleted, bookmarks moved, renamed or removed (removed ones stay in the backup), and every change can be undone. A folder can be analysed again with what the user taught during the review.
- Known sites and typical addresses are filed for sure, the local model files the rest, and the page is read when the title is not enough. Corrections made in the review teach the next sorts.
- Sites that no longer answer are set apart; every bookmark left to check has been tested, can be opened from the list and comes with a suggestion when the model leans somewhere.
- Duplicates are not recreated (one copy is, the backup keeps the others).
- Optional permissions: access to sites, to read the bookmarked pages themselves (no cookies, nothing sent); browsing history, to find the most visited sites and understand vague titles, read on the computer only.
- No data leaves the computer, and the interface says so.
- Chrome first (Manifest V3, Chrome Web Store), Firefox and Edge later.
- Planned next: targeted history cleanup, then a password-protected vault.

## Brand Commitments

- Name: Nidomark. Icon: white bookmark ribbon on a teal rounded tile with an amber sparkle.
- Visual direction requested by the user: faithful to Google's product style (Material 3: clean, light or dark like the browser, rounded corners, one accent colour, Google typography), simple, uncluttered and very intuitive.
- Main screen requested by the user: a simplified n8n-like node view, where the unsorted bookmarks are linked by curves to the proposed folders, a folder opens its bookmarks in a side panel, and a bookmark can be dragged to another folder.
- Sorting rules requested by the user: absolutely every link is filed, the old tree is kept in a dated backup with the application's name, at most three levels, the most visited sites first in the bar as icons only, adult content in a "Porn" folder outside the bar, streaming in "Streaming", and the fact that no data leaves the computer is put forward.

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
