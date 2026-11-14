# Security policy

Nidomark runs entirely in the browser and handles your bookmarks, so security reports are welcome.

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/drslid/Nidomark/security/advisories/new) rather than in a public issue. Include the browser version, the extension version and the steps to reproduce.

## Scope

In scope: the extension's code, its permissions, the handling of bookmarks, history titles, site reading and local storage, the backup and the undo journal, the model download script, the build and the documentation site.

Out of scope: vulnerabilities of the browser itself, of Hugging Face or of third-party websites.

## Design principles

- No network request at run time besides the bookmarked pages, read without cookies and only when the user allows access to sites; the model and runtime are packaged and their hashes are checked at build time.
- Minimal permissions; access to sites and `history` are optional.
- A sort deletes nothing: it recreates the bookmarks in a new tree and moves the previous one, untouched, into a dated backup. Undo removes a copy only while its original still exists, and never overwrites a later change.
