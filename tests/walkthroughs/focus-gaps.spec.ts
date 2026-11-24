/**
 * K38 (perception-core 0.2.0, K37 fix): in a path Focus, the gap edges into and out of a "not curated" card keep the
 * gap style — thin, not sized by path count — and in Layered the stages read top-down in the pack's stage order.
 * PD01 and PL02 both have a null signal_route (a gap card between cascade and integration).
 */
import { test, expect, cy, navSettled } from './_shared';
import { go, PACK, seen } from '../helpers';
const STAGE_ORDER: string[] = PACK('manifest.yaml').stage_kinds.map((k: { id: string }) => k.id);

async function focus(page: import('@playwright/test').Page, pid: string) {
  await seen(page);
  await go(page, `/navigator?view=focus&focus=path:${pid}&path=${pid}`);
  await navSettled(page);
}

for (const pid of ['PD01', 'PL02']) {
  test(`Focus on ${pid}: every gap edge is at most 2 px wide`, async ({ page }) => {
    await focus(page, pid);
    const gaps = await cy<{ id: string; width: number; on: boolean }[]>(
      page,
      `return c.edges('.gap-edge').filter((e) => !e.hasClass('hide')).map((e) => ({ id: e.id(), width: e.numericStyle('width'), on: e.hasClass('on') }));`,
    );
    expect(gaps.length).toBeGreaterThan(0);
    // lit (the state in which 0.1.0 sized them by path count, about 30 px) and still thin
    for (const g of gaps) {
      expect(g.on, g.id).toBe(true);
      expect(g.width, g.id).toBeLessThanOrEqual(2);
    }
  });
}

test('Layered Focus on PL02: the stages read top-down in pack order', async ({ page }) => {
  await focus(page, 'PL02');
  await expect(page.getByTestId('layout-elk')).toHaveAttribute('aria-pressed', 'true');
  const nodes = await cy<{ stage: string; y: number }[]>(
    page,
    `return c.nodes().filter((n) => !n.hasClass('hide') && !n.hasClass('loop-glyph') && !n.hasClass('proposed')).map((n) => ({ stage: n.data('stage') || '', y: n.position('y') }));`,
  );
  const shown = nodes.filter((n) => STAGE_ORDER.includes(n.stage));
  expect(new Set(shown.map((n) => n.stage)).size).toBeGreaterThanOrEqual(5);
  // every node of an earlier stage sits above every node of a later stage
  for (const a of shown)
    for (const b of shown)
      if (STAGE_ORDER.indexOf(a.stage) < STAGE_ORDER.indexOf(b.stage)) expect(a.y, `${a.stage} above ${b.stage}`).toBeLessThan(b.y);
});
