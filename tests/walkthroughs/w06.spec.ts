import { test, expect, lintClean, treeOpen } from './_shared';
import { go, seen } from '../helpers';

test('w6 — show shared receptors and a sense that sits in two branches', async ({ page }) => {
  await seen(page);
  await go(page, '/shared');
  await expect(page.locator('main [data-row-select]')).toHaveCount(13);
  await expect(page.getByTestId('hub-caution')).toContainText('NOT centrality');
  await expect(page.locator('main')).toContainText('PHYB (5)');
  await expect(page.locator('main')).toContainText('CRY1 (4)');
  await lintClean(page, 'centrality');
  // PL02 under Light and under Temperature, the same path
  await go(page, '/tree');
  await expect(page.getByTestId('tree-list').locator('a[href="#/path/PL02"]')).toHaveCount(2);
  await treeOpen(page, 'PL02');
  await expect(page).toHaveURL(/#\/path\/PL02$/);
  await expect(page.locator('main [data-contested]').first()).toBeVisible(); // dual membership ⚑ on the path
});

test('w6 — the tree marks the dual leaf (dual ⚑)', async ({ page }) => {
  await seen(page);
  await go(page, '/tree');
  await expect(page.getByTestId('tree-list').locator('li:has(a[href="#/path/PL02"])').first()).toContainText(/dual/i);
});
