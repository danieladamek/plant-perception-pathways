/**
 * K38 (perception-core 0.2.0): the Glossary, 101s, Freshness and Recent changes surfaces on pack 0.1.2, which has no
 * glossary, no concepts and no upkeep `files`. Empty states show a TODO and never a broken link; Methods keeps the
 * build-time staleness table and shows the change ledger newest first.
 */
import { test, expect, type Page } from '@playwright/test';
import { go, PACK, ROUTES, seen } from '../helpers';

/** every in-app link on the page leads to a route that renders an h1 and no "not found" */
async function linksResolve(page: Page, from: string) {
  const hrefs = await page.locator('main a[href^="#/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!))]);
  for (const h of hrefs) {
    await go(page, h.slice(1));
    await expect(page.locator('h1').first(), `${from} → ${h}`).not.toBeEmpty();
    await expect(page.locator('h1').first(), `${from} → ${h}`).not.toHaveText(/not found/i);
  }
}

test('Glossary: empty state is a TODO, no popovers, links resolve', async ({ page }) => {
  await seen(page);
  await go(page, '/glossary');
  await expect(page.locator('h1').first()).toHaveText('Glossary');
  await expect(page.locator('main .bx-todo').first()).toBeVisible();
  await expect(page.getByTestId('glossary-count')).toHaveCount(0);
  await linksResolve(page, '/glossary');
});

test('101s: empty state is a TODO, not offered in the menu, links resolve', async ({ page }) => {
  await seen(page);
  await go(page, '/concepts');
  await expect(page.locator('h1').first()).toHaveText('101s');
  await expect(page.locator('main .bx-todo').first()).toBeVisible();
  await expect(page.getByTestId('concept-index')).toHaveCount(0);
  await expect(page.locator('a[href="#/concepts"]')).toHaveCount(0);
  await linksResolve(page, '/concepts');
});

test('no route links to a 101 or a glossary entry, and none shows a term popover', async ({ page }) => {
  await seen(page);
  for (const r of ROUTES) {
    await go(page, r);
    await expect(page.locator('h1').first()).not.toBeEmpty();
    await expect(page.locator('a[href^="#/concepts"], [data-concept], [data-gloss-popover], [data-testid="in-glossary"]'), r).toHaveCount(0);
    await expect(page.locator('a[href^="#/glossary#"]'), r).toHaveCount(0);
  }
});

test('Methods: build-time staleness table (no upkeep files), Recent changes newest first', async ({ page }) => {
  await seen(page);
  await go(page, '/methods');
  await expect(page.getByTestId('freshness')).toHaveCount(0);
  await expect(page.getByTestId('staleness')).toBeVisible();
  const ledger = PACK('changes.yaml') as { version: string }[]; // newest first in the pack
  const shown = page.getByTestId('recent-changes').locator('[data-change]');
  await expect(shown).toHaveCount(Math.min(10, ledger.length));
  expect(await shown.evaluateAll((li) => li.map((l) => l.getAttribute('data-change')))).toEqual(ledger.slice(0, 10).map((c) => c.version));
  const res = await page.request.get('/changes.json');
  expect(res.ok()).toBe(true);
  expect((await res.json()).length).toBe(ledger.length);
});
