import { test, expect, coreGap, treeOpen, viewerReady } from './_shared';
import { go, ORIGIN, PACK, recordRequests, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');

test('w3 — learn the UV-B pathway and look at the receptor in 3D', async ({ page }) => {
  await seen(page);
  const rec = recordRequests(page);
  await go(page, '/tree');
  await treeOpen(page, 'PL07');
  await expect(page).toHaveURL(/#\/path\/PL07/);
  await expect(page.locator('[data-stage="receptor"]').first().locator('[data-chip-molecule="UVR8"]')).toBeVisible();
  for (const s of ['signal_route', 'integration']) await expect(page.locator(`[data-stage="${s}"][data-gap]`)).toContainText(strings.gaps.card);
  await expect(page.getByTestId('gap-count')).toHaveText('2 gaps');
  // the UVR8 sheet
  await page.locator('[data-stage="receptor"]').first().locator('[data-chip-molecule="UVR8"]').click();
  await expect(page).toHaveURL(/#\/molecules\/UVR8/);
  await expect(page.getByText('Q9FN03').first()).toBeVisible();
  await expect(page.getByTestId('uniprot-label')).toContainText(strings.labels.uniprot_verbatim);
  await expect(page.locator('main')).toContainText('UV-B specific signaling component'); // FUNCTION, verbatim
  await expect(page.locator('main')).toContainText('Featured: 4D9S');
  await expect(page.locator('main')).toContainText('the rule picked 6QTQ, a COP1 WD40 domain holding a UVR8 C-terminal peptide');
  // the featured structure, from the bundled file
  await viewerReady(page);
  const sr = page.getByTestId('structure-record');
  await expect(sr.locator('[data-badge="experimental"]')).toHaveText(strings.badges.experimental);
  await expect(sr).toContainText('X-RAY DIFFRACTION');
  await expect(sr).toContainText('Å');
  await expect(sr.locator('[data-badge="other-organism"]')).toHaveCount(0); // Arabidopsis: no organism warning
  // must_not: a structure fetched from the network at view time
  expect(rec.foreign().map((r) => r.url())).toEqual([]);
  for (const r of rec.all().filter((x) => /\.(bcif|cif|pdb|sdf)(\?|$)/.test(x.url()))) expect(r.url()).toMatch(new RegExp(`^${ORIGIN}/structures/`));
});

test('w3 must_not — no blank viewer box when WebGL is unavailable', async ({ page }) => {
  await seen(page);
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, t: string, ...a: any[]) {
      if (/webgl/.test(t)) return null;
      return (orig as any).call(this, t, ...a);
    } as any;
  });
  await go(page, '/molecules/UVR8');
  await expect(page.getByTestId('no-webgl')).toBeVisible();
  await expect(page.getByTestId('structure-record')).toContainText('4D9S');
});

test('w3 core gap — the sheet shows the AGI locus and the featured coverage ("whole protein")', async ({ page }) => {
  coreGap('perception-core: a UniProt identity block for plant records (accession, protein name, gene names, AGI locus = ordered_locus_names, organism, reviewed) and the featured `coverage` beside the experimental/predicted badge (app-requirements §2.4); 0.1.0 shows an HGNC block or "TODO(author) no identity record"');
  await seen(page);
  await go(page, '/molecules/UVR8');
  await expect(page.locator('main')).toContainText('At5g63860', { timeout: 3000 });
  await expect(page.locator('main')).toContainText(strings.badges.whole, { timeout: 3000 });
});
