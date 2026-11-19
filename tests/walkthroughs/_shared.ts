/**
 * Walkthrough helpers. One spec file per content-pack/scenarios.yaml entry (ACTION-SPEC §8): each `do` is performed,
 * each `expect` asserted, each `must_not` asserted. An expectation that perception-core 0.1.0 cannot meet is written as
 * its own `test.fail` with a `core-gap` annotation naming the proposed core item (scrum ▶️ Next): it is reported as an
 * expected failure today and turns red the day the core meets it, so the spec is then moved back into the main test.
 */
import { expect, test, type Page } from '@playwright/test';
import { lintPage } from '../helpers';
export { expect, test };

export const coreGap = (item: string) => {
  test.info().annotations.push({ type: 'core-gap', description: item });
  test.fail();
};
export async function lintClean(page: Page, ...ids: string[]) {
  const hits = (await lintPage(page)).filter((h) => ids.includes(h.split(':')[0]));
  expect(hits).toEqual([]);
}
export const viewerReady = (page: Page) => expect(page.locator('[data-viewer-status="ready"]').first()).toBeVisible({ timeout: 45_000 });
/** open every fold of the hierarchy, then follow the link to a path */
export async function treeOpen(page: Page, pid: string) {
  await page.getByTestId('tree-list').evaluate((el) => el.querySelectorAll('details').forEach((d) => d.setAttribute('open', '')));
  await page.getByTestId('tree-list').locator(`a[href="#/path/${pid}"]`).first().click();
}
export const CANVAS = '[data-testid="navigator-canvas"]';
export async function navSettled(page: Page) {
  await expect(page.locator(CANVAS)).toHaveAttribute('data-ready', '1', { timeout: 45_000 });
  await expect(page.locator(CANVAS)).toHaveAttribute('data-busy', '0', { timeout: 45_000 });
  await page.waitForTimeout(200);
}
export const cy = <T = unknown>(page: Page, body: string) => page.evaluate(`(() => { const c = document.querySelector('${CANVAS}')._cy; ${body} })()`) as Promise<T>;
export const view = (page: Page) => cy<string>(page, `const p = c.pan(); return [c.zoom().toFixed(4), p.x.toFixed(1), p.y.toFixed(1)].join(',');`);
