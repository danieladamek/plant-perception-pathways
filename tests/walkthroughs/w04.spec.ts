import { test, expect, coreGap } from './_shared';
import { go, PACK, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');

test('w4 — see the chromophore a blue-light receptor carries', async ({ page }) => {
  await seen(page);
  await go(page, '/molecules/PHOT1');
  await expect(page.locator('main')).toContainText('Featured: 2Z6C');
  await expect(page.getByTestId('n-paths')).toContainText('3 curated paths');
  for (const p of ['PL03', 'PL05', 'PZ05']) await expect(page.locator('main').getByRole('link', { name: p }).first()).toBeVisible();
  // the small-molecule catalogue: FMN with its default filter
  await go(page, '/molecules?tab=small');
  const idx = page.getByTestId('small-index');
  await expect(idx).toContainText('Flavin Mononucleotide'); // visible by default (must_not: a chromophore hidden by the default filter)
  await idx.getByRole('link', { name: /Flavin Mononucleotide/ }).first().click();
  await expect(page).toHaveURL(/#\/molecules\/sm\/CID643976/);
  const sheet = page.locator('section[data-testid="sm-binds"]');
  await expect(page.getByTestId('sm-classes')).toContainText('chromophore');
  for (const [s, m] of [['2Z6C', 'PHOT1'], ['5SVV', 'ZTL'], ['6QQH', 'PHOT2'], ['7WA4', 'GI']]) {
    await expect(sheet).toContainText(s);
    await expect(sheet).toContainText(m);
  }
  // a computed conformer is labelled computed, never presented as an experimental pose
  await expect(page.getByTestId('sm-3d-open')).toContainText('PubChem computed conformer');
  await expect(page.locator('section[data-testid="sm-binds"]')).toContainText('experimental structure');
});

test('w4 core gap — PHOT1 shows "domain structure (129 of 996 residues)"', async ({ page }) => {
  coreGap('perception-core: show the featured structure coverage on the sheet (app-requirements §2.4; molecules.yaml featured.coverage)');
  await seen(page);
  await go(page, '/molecules/PHOT1');
  await expect(page.locator('main')).toContainText('domain structure (129 of 996 residues)', { timeout: 3000 });
  void strings;
});
