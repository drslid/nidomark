import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The tests replay the whole pipeline; a busy machine must not turn them into timeouts.
    testTimeout: 30000,
  },
});
