import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the framework agnostic libraries (schema, widgets, generator).
 * The Angular application has its own test setup (`npm run test:builder`).
 */
export default defineConfig({
  resolve: {
    alias: {
      '@appstudio/schema': fileURLToPath(new URL('./libs/schema/src/index.ts', import.meta.url)),
      '@appstudio/widgets': fileURLToPath(new URL('./libs/widgets/src/index.ts', import.meta.url)),
      '@appstudio/generator': fileURLToPath(new URL('./libs/generator/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['libs/**/src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/**'],
    reporters: ['default'],
  },
});
