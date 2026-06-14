import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.spec.ts'],
    exclude: ['node_modules', 'dist', 'frontend', 'e2e'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'frontend', 'e2e', '**/*.test.ts', '**/*.spec.ts'],
    },
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@modules': path.resolve(__dirname, './modules'),
    },
  },
});
