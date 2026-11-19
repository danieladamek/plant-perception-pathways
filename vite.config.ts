import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { localEndpoints } from './scripts/local-endpoints';

// BASE_PATH: '/' for local delivery; a project-site path if this is ever published (README → "Publishing this later").
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  // localEndpoints(): dev/preview-server middleware only (the notepad's file autosave, UI-18); never part of dist/,
  // and it answers loopback requests only.
  plugins: [react(), localEndpoints(fileURLToPath(new URL('.', import.meta.url)))],
  // perception-core modules read the pack with top-level await (README "Consuming it")
  build: { target: 'es2022', chunkSizeWarningLimit: 6000, sourcemap: false },
  preview: { port: 4201, strictPort: true },
  server: { port: 4201 },
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'scripts/**/*.test.ts'],
    // the core's modules read the pack at load time: install this app's pack before any test file is imported
    setupFiles: ['tests/setup-pack.ts'],
  },
} as any);
