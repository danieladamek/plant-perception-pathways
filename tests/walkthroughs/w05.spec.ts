import { test, expect, coreGap, viewerReady } from './_shared';
import { go, PACK, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');
const plddt = PACK('structures.yaml').structures.find((s: any) => s.molecules[0] === 'RIN4').plddt_mean;

test('w5 — tell a predicted model from an experimental structure', async ({ page }) => {
  await seen(page);
  await go(page, '/molecules/RIN4');
  await viewerReady(page);
  await expect(page.locator('[data-badge="predicted"]').first()).toBeVisible();
  await expect(page.getByTestId('predicted-sentence')).toHaveText(strings.badges.predicted);
  await expect(page.locator('[data-plddt]').first()).toHaveText(String(plddt));
  await expect(page.locator('main')).toContainText('largely disordered; its PDB entries are short fragments bound to bacterial effectors');
  await go(page, '/molecules/ZAR1');
  await expect(page.locator('main')).toContainText('Featured: 6J5T');
  await viewerReady(page);
  await expect(page.getByTestId('structure-record').locator('[data-badge="experimental"]')).toBeVisible();
  // must_not: a predicted model without the predicted badge (every predicted structure: safety suite §8.6)
});

test('w5 core gap — ZAR1 6J5T is labelled "whole protein"', async ({ page }) => {
  coreGap('perception-core: show the featured structure coverage on the sheet (app-requirements §2.4)');
  await seen(page);
  await go(page, '/molecules/ZAR1');
  await expect(page.locator('main')).toContainText(strings.badges.whole, { timeout: 3000 });
});
