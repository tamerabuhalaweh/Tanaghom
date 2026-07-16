import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'seed-production-acceptance': 'scripts/seed-production-acceptance.ts',
  },
  format: ['esm'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  external: [
    '@prisma/client',
    'bcrypt',
    'bullmq',
    'ioredis',
  ],
  noExternal: [],
  esbuildOptions(options) {
    options.alias = {
      '@shared': './shared',
      '@modules': './modules',
    };
  },
});
