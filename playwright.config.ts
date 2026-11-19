import { defineConfig, devices } from '@playwright/test';

// The suite runs against `npm run preview` on its own port, so the ▶ launcher's 4201 can stay open meanwhile.
const PORT = Number(process.env.PPP_PORT ?? 4221);
export default defineConfig({
  testDir: 'tests',
  testMatch: ['smoke/**/*.spec.ts', 'safety/**/*.spec.ts', 'walkthroughs/**/*.spec.ts', 'core/**/*.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  reporter: [['list'], ['json', { outputFile: 'tests/results/playwright.json' }]],
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1280, height: 900 }, acceptDownloads: true },
  projects: [
    { name: 'chromium', testIgnore: ['core/**'], use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    // perception-core's own harness (plant-min fixture, Greenhouse theme), built from the consumed core (KICKOFF §8.1 parity)
    { name: 'core-harness', testDir: 'tests/core', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 }, baseURL: 'http://localhost:4231' } },
  ],
  // BX_NOTES_DIR: the notepad's local file autosave goes to test-results/, never to the reader's notes/ (UI-18)
  webServer: [
    { command: `BX_NOTES_DIR=test-results/notes npm run preview -- --port ${PORT} --strictPort`, port: PORT, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx vite build --config tests/core/harness.vite.config.ts && npx vite preview --config tests/core/harness.vite.config.ts', port: 4231, reuseExistingServer: false, timeout: 180_000 },
  ],
});
