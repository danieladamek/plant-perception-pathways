/**
 * Smoke (KICKOFF §5): every route renders its h1; dark mode persists; 375 px read-only without horizontal scroll;
 * keyboard-only paths through the main surface; the accessible view of My maps supports create, edit and delete;
 * axe WCAG 2 AA on every route in light and dark (p-student uses a screen reader); parity screenshots (§8.1).
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { go, NS, ROUTES, seen } from '../helpers';

const theme = async (page: Page, t: 'light' | 'dark') =>
  page.addInitScript(([ns, v]) => localStorage.setItem(`${ns}:theme`, v), [NS, t] as const);

test.describe('every route renders its h1', () => {
  for (const r of ROUTES)
    test(r, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await seen(page);
      await go(page, r);
      await expect(page.locator('h1').first()).not.toBeEmpty();
      expect(errors).toEqual([]);
    });
});

test('dark mode persists across reloads', async ({ page }) => {
  await seen(page);
  await go(page, '/');
  const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
  const before = await dark();
  await page.getByTestId('theme-toggle').click();
  expect(await dark()).toBe(!before);
  await page.reload();
  await expect(page.locator('h1').first()).toBeVisible();
  expect(await dark()).toBe(!before);
});

test.describe('375 px: every route renders, no horizontal page scroll', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  for (const r of ROUTES)
    test(r, async ({ page }) => {
      await seen(page);
      await go(page, r);
      await page.waitForLoadState('networkidle');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over).toBeLessThanOrEqual(0);
    });
});

test('keyboard only: home → navigator list view → select PD01 → open its path page', async ({ page }) => {
  await seen(page);
  await go(page, '/');
  await page.getByRole('link', { name: /Open the pathway navigator/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/navigator/);
  await page.getByTestId('view-list').focus();
  await page.keyboard.press('Enter');
  const view = page.getByTestId('accessible-view');
  await expect(view).toBeVisible();
  const row = page.locator('[data-rail="PD01"]');
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/path=PD01/);
  await go(page, '/path/PD01');
  await expect(page.getByTestId('pipeline')).toBeVisible();
});

test('accessible view of My maps: create, edit and delete by keyboard', async ({ page }) => {
  await seen(page);
  await go(page, '/maps');
  await page.getByTestId('new-map').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('map-list-view').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('free-node').focus();
  await page.keyboard.type('node one');
  await page.keyboard.press('Enter');
  await page.getByTestId('free-node').fill('node two');
  await page.keyboard.press('Enter');
  const tables = page.getByTestId('map-tables');
  await expect(tables.locator('tbody').first().locator('tr')).toHaveCount(2);
  // edit
  await page.getByLabel('Label of node one').fill('node one edited');
  await expect(page.getByLabel('Label of node one edited')).toBeVisible();
  // link (override) by keyboard
  await page.getByTestId('link-from').selectOption({ label: 'node one edited' });
  await page.getByTestId('link-to').selectOption({ label: 'node two' });
  await page.getByTestId('link-submit').focus();
  await page.keyboard.press('Enter');
  await page.getByTestId('override-reason').fill('keyboard test');
  await page.getByTestId('override-confirm').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('map-header-count')).toContainText('1 links');
  // delete
  await page.getByLabel('Delete link node one edited to node two').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('map-header-count')).toContainText('0 links');
  await page.getByLabel('Delete node node two').focus();
  await page.keyboard.press('Enter');
  await expect(tables.locator('tbody').first().locator('tr')).toHaveCount(1);
});

test.describe('axe WCAG 2 AA on every route, light and dark', () => {
  for (const t of ['light', 'dark'] as const)
    for (const r of ROUTES)
      test(`${r} (${t})`, async ({ page }) => {
        await seen(page);
        await theme(page, t);
        await go(page, r);
        await page.waitForLoadState('networkidle');
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 4).join(' | ')}`)).toEqual([]);
      });
});

test.describe('the 3D viewer has a text alternative and labelled controls (p-student)', () => {
  test('UVR8: the structure record is text; every viewer control is a labelled button', async ({ page }) => {
    await seen(page);
    await go(page, '/molecules/UVR8');
    await expect(page.locator('[data-viewer-status="ready"]')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('structure-record')).toContainText('4D9S');
    const unlabelled = await page.getByTestId('viewer-controls').locator('button').evaluateAll((bs) => bs.filter((b) => !(b.getAttribute('aria-label') || b.textContent?.trim())).length);
    expect(unlabelled).toBe(0);
  });
});

test.describe('parity screenshots (guard future core upgrades)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const shot = async (page: Page, name: string) => {
    await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' });
    await page.waitForTimeout(600);
    await expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.01, animations: 'disabled' });
  };
  test('home', async ({ page }) => {
    await seen(page);
    await theme(page, 'light');
    await go(page, '/');
    await page.evaluate(() => document.fonts.ready);
    await shot(page, 'home.png');
  });
  test('navigator, Focus on PD01', async ({ page }) => {
    await seen(page);
    await theme(page, 'light');
    await go(page, '/navigator?view=focus&focus=path:PD01&path=PD01');
    await expect(page.getByTestId('navigator-canvas')).toHaveAttribute('data-busy', '0', { timeout: 45_000 });
    await shot(page, 'navigator-focus-PD01.png');
  });
  test('molecule sheet (UVR8)', async ({ page }) => {
    await seen(page);
    await theme(page, 'light');
    await go(page, '/molecules/UVR8');
    await page.locator('[data-viewer-status]').first().waitFor();
    await page.evaluate(() => document.querySelectorAll('canvas').forEach((c) => (c.style.visibility = 'hidden')));
    await shot(page, 'molecule-UVR8.png');
  });
  test('structure (4D9S)', async ({ page }) => {
    await seen(page);
    await theme(page, 'light');
    await go(page, '/structures/4D9S');
    await expect(page.locator('[data-viewer-status="ready"]')).toBeVisible({ timeout: 45_000 });
    await page.evaluate(() => document.querySelectorAll('canvas').forEach((c) => (c.style.visibility = 'hidden')));
    await shot(page, 'structure-4D9S.png');
  });
});
