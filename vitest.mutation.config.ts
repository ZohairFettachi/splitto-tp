import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/balances.test.ts',
      'tests/unit/simplify.test.ts',
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
