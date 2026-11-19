import fs from 'node:fs';
import { test, expect } from './_shared';
import { go, seen } from '../helpers';

test('w8 — filter the evidence table and export', async ({ page }, info) => {
  await seen(page);
  await go(page, '/evidence');
  await page.locator('[data-filter="tier"]').selectOption('B1');
  await expect(page.locator('[data-row]')).toHaveCount(33);
  await page.locator('[data-filter="tier"]').selectOption('');
  await page.locator('[data-filter="contested"]').check();
  await expect(page.locator('[data-row]')).toHaveCount(21);
  const ids = await page.locator('[data-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-row')));
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-csv').click()]);
  const p = info.outputPath('rows.csv');
  await d.saveAs(p);
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  // must_not: an export that includes rows the filter hides
  expect(lines).toHaveLength(22);
  expect(lines.slice(1).map((l) => l.split(',')[0])).toEqual(ids);
  for (const col of ['stimulus', 'receptor', 'cascade', 'signal_route', 'integration', 'response', 'response_role']) expect(lines[0]).toContain(col);
});
