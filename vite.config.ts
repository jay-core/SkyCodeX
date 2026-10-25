import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'node:path';

// Renderer build. Main and preload are bundled separately by src/build/build-main.mjs.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [solid()],
  publicDir: resolve(__dirname, 'assets/fonts'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    target: 'chrome130',
    chunkSizeWarningLimit: 4000,
  },
  test: {
    root: __dirname,
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
} as any);
