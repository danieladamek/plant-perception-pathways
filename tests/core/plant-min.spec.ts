/**
 * KICKOFF §8.1 parity: perception-core's harness (plant-min fixture, Greenhouse theme) passes at the version this app
 * consumes (0.1.0). The same checks as the core's own `core-harness` project in PPE: every route renders, no console
 * errors, axe WCAG 2 AA in light and dark, stages from the pack.
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const ROUTES = ['/', '/navigator', '/navigator?view=list', '/path/X001', '/path/X002', '/tree', '/evidence', '/molecules', '/molecules/FX-R1', '/shared', '/interactions', '/maps', '/references', '/percepts', '/methods', '/about', '/notes'];

async function open(page: Page, hash: string, theme: 'light' | 'dark') {
  await page.addInitScript((t) => {
    localStorage.setItem('plant-min-fixture:theme', t);
    localStorage.setItem('plant-min-fixture:notice-seen', '1');
  }, theme);
  await page.goto(`/#${hash}`);
  await expect(page.locator('h1').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
}

test.describe('core harness: plant-min fixture under the Greenhouse theme', () => {
  for (const theme of ['light', 'dark'] as const)
    for (const r of ROUTES)
      test(`${r} (${theme}): renders, no console errors, axe WCAG 2 AA`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        await open(page, r, theme);
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'greenhouse');
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)).toEqual([]);
        expect(errors).toEqual([]);
      });

  test('stages come from the fixture pack', async ({ page }) => {
    await open(page, '/path/X001', 'light');
    await expect(page.getByTestId('pipeline')).toHaveAttribute('aria-label', /stimulus to response, 7 stages/);
    await expect(page.locator('main')).not.toContainText(/ganglion|afferent|efferent|cranial|atlas/i);
  });
});
