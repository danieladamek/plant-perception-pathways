import { test, expect, viewerReady } from './_shared';
import { go, PACK, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');

test('w7 — find the rows whose evidence is not from Arabidopsis', async ({ page }) => {
  await seen(page);
  await go(page, '/evidence');
  // the 🌱 badge on exactly the other-species rows; PSI01 and PZ04 mixed
  const other = await page.locator('[data-row]:has([data-species="other species-only"])').evaluateAll((els) => els.map((e) => e.getAttribute('data-row')).sort());
  expect(other).toEqual(['PS01', 'PS02', 'PZ02', 'PZ03', 'PZ07']);
  for (const id of other) await expect(page.locator(`[data-row="${id}"] [data-species]`)).toContainText('🌱');
  for (const id of ['PSI01', 'PZ04']) await expect(page.locator(`[data-row="${id}"] [data-species="mixed"]`)).toBeVisible();
  await expect(page.locator('[data-row="PD01"] [data-species="Arabidopsis"]')).toBeVisible();
  await expect(page.locator('[data-row="PD01"] [data-species]')).not.toContainText('🌱');
  await expect(page.locator('[data-row="PS01"] [data-species]')).toContainText('not Arabidopsis');
  // PS01 and its NFR5 sheet
  await go(page, '/path/PS01');
  for (const s of ['Lotus japonicus', 'Medicago truncatula', 'alfalfa', 'pea']) await expect(page.locator('main [data-species]').first()).toContainText(s);
  await go(page, '/molecules/NFR5');
  await viewerReady(page);
  await expect(page.getByTestId('structure-record').locator('[data-badge="other-organism"]')).toContainText('the Arabidopsis protein may differ');
  // must_not: an other-species row drawn as Arabidopsis evidence
  await go(page, '/navigator?view=list');
  await expect(page.locator('[data-species="Arabidopsis"]:has-text("NOT Arabidopsis")')).toHaveCount(0);
});

test('w7 — the species filter offers "other species"', async ({ page }) => {
  await seen(page);
  await go(page, '/evidence');
  await page.locator('[data-filter="species"]').selectOption({ label: 'other species' });
});

test('w7 — NFR5 carries "UniProt record not reviewed"', async ({ page }) => {
  await seen(page);
  await go(page, '/molecules/NFR5');
  await expect(page.locator('main')).toContainText(strings.badges.unreviewed);
});
