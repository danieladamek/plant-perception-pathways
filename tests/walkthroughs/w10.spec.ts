import { test, expect } from './_shared';
import { go, seen } from '../helpers';

test('w10 — find abscisic acid, alone and bound to its receptor', async ({ page }) => {
  await seen(page);
  // search finds the paths that name it; the catalogue lists the compound
  await go(page, '/');
  await page.keyboard.press('/');
  await page.locator('#search-q').fill('abscisic');
  await expect(page.locator('[data-hit="path"][data-id="PD01"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await go(page, '/molecules?tab=small');
  await page.getByTestId('small-index').getByRole('link', { name: /^Abscisic Acid/ }).first().click();
  await expect(page).toHaveURL(/#\/molecules\/sm\/CID5280896/);
  const sheet = page.getByTestId('small-sheet');
  await expect(sheet.locator('h1')).toContainText('Abscisic Acid');
  for (const p of ['PD01', 'PD02']) await expect(sheet.getByRole('link', { name: p }).first()).toBeVisible();
  for (const [s, m] of [['3W9R', 'PYL9'], ['3KDJ', 'ABI1']]) {
    await expect(page.locator('section[data-testid="sm-binds"]')).toContainText(s);
    await expect(page.locator('section[data-testid="sm-binds"]')).toContainText(m);
  }
  await expect(page.getByTestId('sm-3d-open')).toContainText('PubChem computed conformer');
  // JA-Ile: one sheet with both stereo forms (must_not: two sheets for one compound's stereo forms)
  await go(page, '/molecules?tab=small');
  await expect(page.getByTestId('small-index').getByRole('link', { name: /JA-L-Ile/ })).toHaveCount(1);
  await go(page, '/molecules/sm/CID5497150');
  const forms = await page.getByTestId('sm-forms').innerText();
  expect(forms).toContain('(-)-JA-L-Ile');
  expect(forms).toContain('(+)-7-iso-JA-L-Ile');
  for (const p of ['PW01', 'PT04']) await expect(page.getByTestId('small-sheet').getByRole('link', { name: p }).first()).toBeVisible();
});

test('w10 — search "abscisic" lists Abscisic Acid from the small-molecule catalogue', async ({ page }) => {
  await seen(page);
  await go(page, '/');
  await page.keyboard.press('/');
  await page.locator('#search-q').fill('abscisic');
  await expect(page.locator('[data-hit][data-id="CID5280896"]')).toBeVisible();
});
