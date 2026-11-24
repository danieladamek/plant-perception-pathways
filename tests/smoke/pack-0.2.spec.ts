/**
 * K40 (pack 0.2.0 on perception-core 0.3.0): Glossary and 101s render with content, a term popover opens on a path
 * page, "Learn the concept" opens its 101, Methods → Freshness lists every upkeep class, Recent changes newest first.
 * Replaces K38's empty-state checks (pack 0.1 had no glossary, no concepts and no upkeep `files`).
 */
import fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { go, PACK, ROUTES, seen } from '../helpers';

const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8')) as { id: string; kind: string; concept?: string }[];
const concepts = JSON.parse(fs.readFileSync('src/data/concepts.json', 'utf8')) as { id: string; title: string; one_liner: string }[];
const upkeep = PACK('upkeep.yaml') as { classes: { id: string; recheck_days: number; how: string }[] };

/** every in-app link in main leads to a route that renders an h1 and no "not found" */
async function linksResolve(page: Page, from: string) {
  const hrefs = await page.locator('main a[href^="#/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!.split('#').slice(0, 2).join('#')))]);
  for (const h of hrefs) {
    await go(page, h.slice(1));
    await expect(page.locator('h1').first(), `${from} → ${h}`).not.toBeEmpty();
    await expect(page.locator('h1').first(), `${from} → ${h}`).not.toHaveText(/not found/i);
  }
}

test('Glossary renders every pack term with its basis; no TODO; kind counts; links resolve', async ({ page }) => {
  test.setTimeout(300_000); // "Used in" links reach most paths and molecules
  await seen(page);
  await go(page, '/glossary');
  await expect(page.locator('h1').first()).toHaveText('Glossary');
  await expect(page.locator('[data-glossary-entry]')).toHaveCount(glossary.length);
  expect(glossary.length).toBe(102); // app-methods §11.3
  await expect(page.locator('main .bx-todo')).toHaveCount(0);
  for (const k of ['science', 'methods', 'notation']) await expect(page.locator(`[data-kind-filter="${k}"]`)).toContainText(`(${glossary.filter((g) => g.kind === k).length})`);
  const noBasis = await page.evaluate(() => [...document.querySelectorAll('[data-glossary-entry]')].filter((e) => !e.querySelector('[data-basis]')?.textContent?.trim()).map((e) => e.id));
  expect(noBasis).toEqual([]);
  await expect(page.locator('main').getByText('<!--')).toHaveCount(0);
  await linksResolve(page, '/glossary');
});

test('101s: the index lists the four in prerequisite order; each renders; offered in the menu', async ({ page }) => {
  test.setTimeout(180_000);
  await seen(page);
  await go(page, '/concepts');
  await expect(page.locator('h1').first()).toHaveText('101s');
  await expect(page.locator('main .bx-todo')).toHaveCount(0);
  await expect(page.getByTestId('concept-index')).toBeVisible();
  expect(concepts.length).toBe(4); // app-methods §12.1
  // prerequisite order: each 101 comes after the ones it builds on
  const at = new Map(concepts.map((c, i) => [c.id, i]));
  for (const c of concepts as unknown as { id: string; prerequisites: string[] }[]) for (const p of c.prerequisites) expect(at.get(p)!, `${p} before ${c.id}`).toBeLessThan(at.get(c.id)!);
  const listed = await page.getByTestId('concept-index').locator('a[href^="#/concepts/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!.replace('#/concepts/', '')))]);
  expect(listed).toEqual(concepts.map((c) => c.id));
  for (const c of concepts) {
    await go(page, `/concepts/${c.id}`);
    await expect(page.locator('h1')).toHaveText(c.title);
    await expect(page.getByTestId('one-liner')).toHaveText(c.one_liner);
    expect(await page.locator('[data-block]').count(), c.id).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.body.innerText)).not.toContain('<!--');
    await linksResolve(page, `/concepts/${c.id}`);
  }
  await go(page, '/glossary');
  await expect(page.locator('a[href="#/concepts"]').first()).toBeAttached();
});

test('a term popover opens on a path page, and Learn the concept opens its 101', async ({ page }) => {
  await seen(page);
  await go(page, '/path/PD01');
  const terms = page.locator('main button.bx-term');
  expect(await terms.count()).toBeGreaterThan(0);
  // the first term on the page whose entry names a 101
  const ids = await terms.evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? ''));
  const withConcept = new Set(glossary.filter((g) => g.concept).map((g) => g.id));
  let opened: string | null = null;
  for (let i = 0; i < ids.length && !opened; i++) {
    await terms.nth(i).click();
    const pop = page.locator('[data-gloss-popover]').first();
    await expect(pop).toBeVisible();
    const id = (await pop.getAttribute('data-gloss-popover'))!;
    if (withConcept.has(id)) opened = id;
    else await page.keyboard.press('Escape');
  }
  expect(opened, 'a term on PD01 whose entry names a 101').not.toBeNull();
  const pop = page.locator(`[data-gloss-popover="${opened}"]`);
  await expect(pop.getByRole('link', { name: 'Open in glossary' })).toBeVisible();
  await pop.locator('[data-learn-concept]').click();
  const c = concepts.find((x) => x.id === glossary.find((g) => g.id === opened)!.concept)!;
  await expect(page).toHaveURL(new RegExp(`#/concepts/${c.id}$`));
  await expect(page.locator('h1')).toHaveText(c.title);
});

test('the contextual 101 links sit at the slots app-methods §12.2 names', async ({ page }) => {
  await seen(page);
  await go(page, '/path/PD01');
  await expect(page.locator('[data-concept-link="stage_row"] a')).toHaveAttribute('href', '#/concepts/how-a-path-is-curated');
  await go(page, '/tree');
  await expect(page.locator('[data-concept-link="hierarchy"] a').first()).toHaveAttribute('href', '#/concepts/how-a-path-is-curated');
});

test('Methods: Freshness lists all six upkeep classes; Recent changes newest first; public JSON served', async ({ page }) => {
  await seen(page);
  await go(page, '/methods');
  await expect(page.getByTestId('freshness')).toBeVisible();
  const rows = page.locator('[data-testid="freshness"] tr[data-fresh-class]');
  expect(upkeep.classes.length).toBe(6);
  await expect(rows).toHaveCount(upkeep.classes.length);
  expect(await rows.evaluateAll((rs) => rs.map((r) => r.getAttribute('data-fresh-class')))).toEqual(upkeep.classes.map((c) => c.id));
  for (const c of upkeep.classes) {
    const r = page.locator(`tr[data-fresh-class="${c.id}"]`);
    await expect(r).toContainText(`${c.recheck_days} days`);
    await expect(r.locator('[data-fresh-oldest]')).toHaveText(/^\d{4}-\d{2}-\d{2}$/);
  }
  const ledger = PACK('changes.yaml') as { version: string }[]; // newest first in the pack
  const shown = page.getByTestId('recent-changes').locator('[data-change]');
  await expect(shown).toHaveCount(Math.min(10, ledger.length));
  expect(await shown.evaluateAll((li) => li.map((l) => l.getAttribute('data-change')))).toEqual(ledger.slice(0, 10).map((c) => c.version));
  for (const f of ['/changes.json', '/freshness.json']) expect((await page.request.get(f)).ok(), f).toBe(true);
  expect((await (await page.request.get('/changes.json')).json()).length).toBe(ledger.length);
});

test('no route shows the pack-0.1 "no glossary or primers" warning', async ({ page }) => {
  await seen(page);
  for (const r of ROUTES) {
    await go(page, r);
    expect(await page.evaluate(() => document.body.innerText), r).not.toMatch(/pack 0\.1 has no glossary|no glossary in pack 0\.1|no primer pages/i);
  }
});
