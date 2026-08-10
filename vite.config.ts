/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173 },
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
});
