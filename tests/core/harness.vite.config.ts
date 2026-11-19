/**
 * perception-core's own test harness (packages/perception-core/harness: the plant-min fixture under the Greenhouse
 * theme), built from the core this app consumes, read-only: the source tree is PPE's (identical to the tag
 * perception-core-v0.1.0, 6f5f73d), while the build output and Vite's cache stay in this app's test-results/
 * (KICKOFF §8.1 parity; nothing is written to ../perception-pathways-explorer/).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { fileURLToPath, URL } from 'node:url';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const root = here('../../../perception-pathways-explorer/packages/perception-core/harness/');
export default defineConfig({
  root,
  cacheDir: here('../../test-results/core-harness-vite-cache'),
  plugins: [react()],
  css: { postcss: { plugins: [tailwind({ config: `${root}tailwind.config.js` }), autoprefixer()] } },
  build: { target: 'es2022', outDir: here('../../test-results/core-harness-dist'), emptyOutDir: true, chunkSizeWarningLimit: 6000 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  preview: { port: 4231, strictPort: true },
});
