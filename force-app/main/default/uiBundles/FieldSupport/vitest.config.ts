import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    // The template's e2e/*.spec.ts are Playwright specs; keep them out of vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
