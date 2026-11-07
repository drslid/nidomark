# Contributing

Thanks for helping. Issues and pull requests are welcome in English or French.

1. Open an issue first for a new feature or a large change.
2. Fork, then `pnpm install && pnpm fetch-model`.
3. Keep changes focused, with tests: `pnpm check` must pass, and `pnpm e2e` for changes to the page or the classifier.
4. Add every new user-facing string to `public/_locales/en` and `public/_locales/fr`.
5. Never commit model files, secrets or personal bookmarks.

Classifier changes must not lower the result on the fictitious collection (`tests/classify.test.ts`). When you change a threshold, explain why in the pull request.
