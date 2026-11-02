import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

// the analyser's version: a flow picture kept from last time (state/flow-kept) is shown only if made by the same code
const analyser = createHash('sha1');
for (const d of ['src/shared', 'src/renderer/lib']) for (const f of fs.readdirSync(resolve(__dirname, d)).sort()) analyser.update(`${d}/${f}\n`).update(fs.readFileSync(resolve(__dirname, d, f)));

// Renderer build. Main and preload are bundled separately by src/build/build-main.mjs.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [solid()],
  define: { __ANALYSER__: JSON.stringify(analyser.digest('hex').slice(0, 16)) },
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
