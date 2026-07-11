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
      include: ['modules/**/*.ts', 'shared/**/*.ts', 'src/**/*.ts'],
      exclude: [
        'node_modules',
        'dist',
        'frontend',
        'e2e',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/index.ts',
      ],
      thresholds: {
        statements: 40,
        branches: 66,
        functions: 60,
        lines: 40,
      },
    },
    setupFiles: [],
    env: {
      JWT_SECRET: 'test-jwt-secret-for-testing-only-at-least-32-chars',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@modules': path.resolve(__dirname, './modules'),
    },
  },
});
