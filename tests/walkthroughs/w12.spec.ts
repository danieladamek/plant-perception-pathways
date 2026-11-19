import { test, expect, cy, navSettled } from './_shared';
import { go, PACK, recordRequests, seen, ORIGIN } from '../helpers';
const anatomy = PACK('anatomy.yaml').values;

test('w12 — the shared core works on a plant path (navigator, Focus, full screen, notepad, My maps)', async ({ page }) => {
  test.setTimeout(180_000);
  await seen(page);
  const rec = recordRequests(page);
  await go(page, '/navigator');
  await navSettled(page);
  // search PD01, select it, press Focus
  await page.locator('[data-rail="PD01"]').click();
  await page.getByTestId('panel-focus-path').click();
  await expect(page).toHaveURL(/view=focus/);
  await navSettled(page);
  // Focus reads in order: every shown step's target is below its source (layered top-down, stimulus first)
  const order = await cy<{ id: string; stage: string; y: number; x: number }[]>(page, `return c.nodes().filter((n) => !n.hasClass('hide') && !n.hasClass('loop-glyph')).map((n) => ({ id: n.id(), stage: n.data('stage') || (n.hasClass('gap') ? 'gap' : ''), y: n.position('y'), x: n.position('x') }));`);
  const ids = order.map((n) => n.id);
  for (const m of ['PYR1', 'PYL9', 'ABI1']) expect(ids).toContain(`mol::${m}`);
  const steps = await cy<{ dy: number }[]>(page, `return c.edges().filter((e) => !e.hasClass('hide') && !e.hasClass('gap-edge') && !e.hasClass('loop-bracket') && !e.hasClass('proposed-edge')).map((e) => ({ dy: e.target().position('y') - e.source().position('y') }));`);
  expect(steps.length).toBeGreaterThan(0);
  for (const s of steps) expect(s.dy).toBeGreaterThan(0);
  // PD01 has no signal route: a dashed gap card
  expect(await cy<number>(page, `return c.nodes('.gap').filter((n) => !n.hasClass('hide')).length;`)).toBeGreaterThan(0);
  // switching layouts keeps the selection
  await page.getByTestId('layout-fcose').click();
  await navSettled(page);
  await expect(page).toHaveURL(/path=PD01/);
  await page.getByTestId('layout-elk').click();
  await navSettled(page);
  await expect(page).toHaveURL(/path=PD01/);
  // stage inspector: cascade chips SRK2E (OST1) and SLAC1; response 'stomatal closure' → PO:0002000, curator mapping
  await go(page, '/path/PD01?stage=cascade');
  const insp = page.getByTestId('stage-inspector');
  await expect(insp).toBeVisible();
  for (const m of ['SRK2E', 'SLAC1']) await expect(page.locator(`[data-stage="cascade"] [data-chip-molecule="${m}"]`).first()).toBeVisible();
  const resp = anatomy.find((v: any) => v.stage === 'response' && v.paths.includes('PD01'));
  expect(resp.terms.map((t: any) => t.id)).toContain('PO:0002000');
  await page.locator('[data-stage="response"]').first().click();
  await expect(insp).toContainText('PO:0002000');
  await expect(insp).toContainText('stomatal complex');
  await expect(insp).toContainText('curator mapping');
  // full screen (the 3D viewer, UI-20) on a PD01 receptor: hide the controls and the info bar, then restore them
  await go(page, '/molecules/PYR1');
  await expect(page.locator('[data-viewer-status="ready"]').first()).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('fs-enter').click();
  await expect(page.getByTestId('fs-overlay')).toBeVisible();
  const ctl = page.getByTestId('fs-controls');
  const inf = page.getByTestId('fs-info');
  const p0 = [await ctl.getAttribute('aria-pressed'), await inf.getAttribute('aria-pressed')];
  await ctl.click();
  await inf.click();
  expect([await ctl.getAttribute('aria-pressed'), await inf.getAttribute('aria-pressed')]).not.toEqual(p0);
  await ctl.click();
  await inf.click();
  expect([await ctl.getAttribute('aria-pressed'), await inf.getAttribute('aria-pressed')]).toEqual(p0);
  await page.getByTestId('fs-exit').click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  // a note on the PD01 cascade card survives a reload, anchored to the card
  await go(page, '/path/PD01?stage=cascade');
  await insp.getByTestId('note-this').click();
  const drawer = page.getByTestId('notepad-drawer');
  const n = drawer.locator('[data-testid="note"]').first();
  await expect(n).toHaveAttribute('data-note-id', /PD01#cascade/);
  await n.getByTestId('note-body').fill('w12 cascade note');
  await page.keyboard.press('Escape');
  await page.reload();
  await go(page, '/notes');
  const kept = page.locator('[data-testid="note"]', { hasText: 'w12 cascade note' });
  await expect(kept).toHaveCount(1);
  await kept.getByTestId('note-follow').click();
  await expect(page).toHaveURL(/#\/path\/PD01/);
  // save to My maps: exactly the nodes and links shown in Focus, links curated with PD01
  await go(page, '/navigator?view=focus&focus=path:PD01&path=PD01');
  await navSettled(page);
  const shown = await cy<{ nodes: string[]; edges: number }>(page, `const ns = c.nodes().filter((n) => !n.hasClass('hide') && !n.hasClass('gap') && !n.hasClass('loop-glyph') && !n.hasClass('proposed')); return { nodes: ns.map((n) => n.id()), edges: c.edges().filter((e) => !e.hasClass('hide') && !e.hasClass('gap-edge') && !e.hasClass('loop-bracket') && !e.hasClass('proposed-edge') && !e.hasClass('loop')).length };`);
  await page.getByTestId('save-to-maps-open').click();
  const dlg = page.getByTestId('save-to-maps');
  await dlg.locator('[data-stm-option="screen"], [data-stm-source="screen"]').first().click();
  await dlg.getByTestId('stm-save').click();
  await page.getByTestId('stm-toast-open').click();
  await expect(page).toHaveURL(/#\/maps/);
  await page.getByTestId('map-list-view').click();
  await expect(page.getByTestId('map-tables').locator('tbody').first().locator('tr')).toHaveCount(shown.nodes.length);
  const sup = page.getByTestId('edge-support');
  await expect(sup.locator('[data-edge-basis="curated"]')).toHaveCount(shown.edges);
  await expect(sup.locator('[data-edge-basis="override"]')).toHaveCount(0);
  await expect(sup.locator('[data-edge-basis="curated"]').first()).toContainText('PD01');
  // must_not: note text in a request (the loopback file autosave is the one allowed path)
  expect(rec.containing('w12 cascade note').filter((r) => !(r.url() === `${ORIGIN}/__local/notes` && r.method() === 'PUT'))).toHaveLength(0);
});
