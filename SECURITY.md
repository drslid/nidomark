# Security policy

Nidomark runs entirely in the browser and handles your bookmarks, so security reports are welcome.

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub security advisories](https://github.com/drslid/nidomark/security/advisories/new) rather than in a public issue. Include the browser version, the extension version and the steps to reproduce.

## Scope

In scope: the extension's code, its permissions, the handling of bookmarks, history titles and local storage, the undo journal, the model download script and the build.

Out of scope: vulnerabilities of the browser itself, of Hugging Face or of third-party websites.

## Design principles

- No network request at run time; the model and runtime are packaged and their hashes are checked at build time.
- Minimal permissions; `history` is optional.
- A sort never deletes bookmarks and can be undone.
