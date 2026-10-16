import { defineConfig } from 'vitest/config';

// Unit tests for the Cloud Functions (pure logic only: no Firebase, no Gemini calls).
// Run from the repository root with `npm run test:functions`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
