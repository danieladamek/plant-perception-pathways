import fs from 'node:fs';
import { test, expect, coreGap } from './_shared';
import { go, PACK, recordRequests, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');

async function sketch(page: any) {
  await go(page, '/maps');
  await page.getByTestId('new-map').click();
  for (const q of ['PYR1', 'SRK2E', 'SLAC1']) {
    await page.getByTestId('vocab-q').fill(q);
    await page.locator(`[data-vocab="m:${q}"]`).click();
  }
  await page.getByTestId('free-node').fill('my guard-cell model');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByTestId('map-list-view').click();
  await expect(page.getByTestId('map-tables').locator('tbody').first().locator('tr')).toHaveCount(4);
  const link = async (a: string, b: string) => {
    await page.getByTestId('link-from').selectOption({ label: a });
    await page.getByTestId('link-to').selectOption({ label: b });
    await page.getByTestId('link-submit').click();
  };
  return link;
}

test('w9 — sketch a drought and CO2 crossover and see which links are supported', async ({ page }, info) => {
  await seen(page);
  const rec = recordRequests(page);
  const link = await sketch(page);
  // vocabulary nodes link to their molecule sheets
  await page.getByLabel('Label of PYR1').focus();
  await expect(page.getByTestId('map-node-panel').getByRole('link', { name: 'sheet' })).toHaveAttribute('href', '#/molecules/PYR1');
  // the free-node link needs an override reason and is flagged
  await link('SLAC1', 'my guard-cell model');
  await expect(page.getByTestId('override-dialog')).toBeVisible();
  await expect(page.getByTestId('override-confirm')).toBeDisabled();
  await page.getByTestId('override-reason').fill('our guard-cell hypothesis');
  await page.getByTestId('override-confirm').click();
  await expect(page.getByTestId('edge-support').locator('[data-edge-basis="override"]')).toBeVisible();
  // export Markdown: each link with its basis and the override reason
  const [dm] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-md').click()]);
  const mdPath = info.outputPath('map.md');
  await dm.saveAs(mdPath);
  const md = fs.readFileSync(mdPath, 'utf8');
  expect(md).toContain('our guard-cell hypothesis');
  expect(md).toContain(strings.maps.override_flag_legend);
  // must_not: an override link drawn like a curated one (the support panel flags it)
  await expect(page.getByTestId('edge-support').locator('[data-edge-basis="override"]')).toContainText('override');
  expect(rec.containing('guard-cell')).toHaveLength(0);
});

test('w9 core gap — PYR1 → SRK2E and SRK2E → SLAC1 are "curated" (PD01; also PCD01)', async ({ page }) => {
  coreGap('perception-core: My maps resolves a molecule whose stage is not the molecule stage (SRK2E, SLAC1: cascade) to the stage node that names it, so a curated path can back the link; 0.1.0 only knows receptor-stage molecule nodes');
  await seen(page);
  const link = await sketch(page);
  await link('PYR1', 'SRK2E');
  await expect(page.getByTestId('override-dialog')).toHaveCount(0, { timeout: 3000 });
  await link('SRK2E', 'SLAC1');
  await expect(page.getByTestId('map-header-count')).toHaveText('2 links: 2 curated · 0 override', { timeout: 3000 });
});
