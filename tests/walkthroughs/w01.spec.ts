import { test, expect, lintClean } from './_shared';
import { go, PACK, recordRequests, seen } from '../helpers';
const strings = PACK('ui-strings.yaml');
const pw01 = PACK('paths.yaml').paths.find((p: any) => p.path_id === 'PW01');

test('w1 — before citing the wound-signalling path, check every step and flag', async ({ page }) => {
  await seen(page);
  const rec = recordRequests(page);
  await go(page, '/path/PW01');
  // six stage cards stimulus → response (plus the response role card), no gap
  for (const s of ['stimulus', 'receptor', 'cascade', 'signal_route', 'integration', 'response']) {
    await expect(page.locator(`[data-stage="${s}"]`).first()).toBeVisible();
    await expect(page.locator(`[data-stage="${s}"][data-gap]`)).toHaveCount(0);
  }
  await expect(page.getByTestId('gap-count')).toHaveText('0 gaps');
  const rc = page.locator('[data-stage="receptor"]').first();
  for (const m of ['GLR3.3', 'GLR3.6', 'GLR3.2', 'MSL10']) await expect(rc.locator(`[data-chip-molecule="${m}"]`)).toHaveAttribute('href', `#/molecules/${m}`);
  // the hypothesis line: shown with its ⚑, marked contested, not as an established step
  expect(pw01.hypothesis_group).toContain('proposed ⚑');
  await expect(page.locator('main')).toContainText(pw01.hypothesis_group);
  await expect(page.locator('main [data-contested]').first()).toBeVisible();
  // references: six, each verified, abstracts verbatim, and the verified-means line
  const panel = page.getByTestId('path-panel');
  expect(pw01.refs).toHaveLength(6);
  for (const n of pw01.refs) await expect(panel.locator(`[data-ref="${n}"][data-verified="true"]`).first()).toBeVisible();
  const show = panel.getByRole('button', { name: 'Show abstract, verbatim' });
  while (await show.count()) await show.first().click();
  await expect(panel.locator('[data-abstract]')).toHaveCount(6);
  await expect(page.locator('main')).toContainText(strings.labels.verified_meaning);
  // must_not
  expect(rec.foreign().map((r) => r.url())).toEqual([]);
  await lintClean(page, 'jargon', 'centrality');
});

test('w1 — the hypothesis is badged "proposed", not only "contested"', async ({ page }) => {
  await seen(page);
  await go(page, '/path/PW01');
  await expect(page.locator('main .pp-proposed').first()).toBeVisible();
});

test('w1 — citation status "yes (abstracts)" (every key citation verified) is shown as verified', async ({ page }) => {
  // pack 0.1.2 (K36): citation_verified uses PPE's vocabulary, so the core renders the verified style
  const pd01 = PACK('paths.yaml').paths.find((p: any) => p.path_id === 'PD01');
  expect(pd01.citation_verified).toBe('yes (abstracts)');
  await seen(page);
  await go(page, '/path/PD01');
  const main = page.locator('main');
  await expect(main.locator('[data-citation="verified"]').first()).toBeVisible();
  await expect(main.locator('[data-citation="unverified"]')).toHaveCount(0);
});
