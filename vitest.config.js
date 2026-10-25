import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// UI tests only. They talk to a real backend: run them with `npm run test:ui` (scripts/e2e.sh).
// The engine tests use Node's built-in runner (npm test).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.ui.test.jsx'],
    testTimeout: 20000,
  },
});
