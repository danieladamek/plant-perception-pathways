/**
 * w13 (pack 0.2; app-methods §11–12): look up a term and learn the concept behind a path. Every expectation is read
 * from the pack (glossary.yaml, concepts/, references) or the content build's output, never retyped.
 */
import fs from 'node:fs';
import { test, expect, coreGap } from './_shared';
import { go, ORIGIN, PACK, recordRequests, seen } from '../helpers';

type G = { id: string; term: string; short: string; definition: string; basis: string; concept?: string; definition_source?: { id: string; label: string; source: string; retrieved_on: string | Date; mapping?: string }; used_in?: { paths: string[] } };
const glossary = JSON.parse(fs.readFileSync('src/data/glossary.json', 'utf8')) as G[];
const byId = new Map(glossary.map((g) => [g.id, g]));
type C = { id: string; title: string; prerequisites: string[]; sections: { blocks: { text: string; framing: boolean; cites: number[] }[] }[] };
const concepts = JSON.parse(fs.readFileSync('src/data/concepts.json', 'utf8')) as C[];
const cById = new Map(concepts.map((c) => [c.id, c]));
const refs = JSON.parse(fs.readFileSync('src/data/references.json', 'utf8')) as { n: number; verified: boolean; abstract: string | null }[];
const paths = PACK('paths.yaml').paths as { path_id: string; perception_branch: string }[];
const index = JSON.parse(fs.readFileSync('src/data/molecules-index.json', 'utf8')) as { id: string; featured: { source_db?: string } | null }[];
const SLOTS = Object.fromEntries([...fs.readFileSync('src/main.tsx', 'utf8').matchAll(/^\s+(stage_row|hierarchy|viewer|computed_badge): '([a-z0-9-]+)'/gm)].map((m) => [m[1], m[2]])) as Record<string, string>;

const aba = byId.get('abscisic-acid')!;
const si = byId.get('self-incompatibility')!;

test('w13 — look up a term and learn the concept behind a path', async ({ page }) => {
  test.setTimeout(300_000); // the must_not walks every link on the glossary and the four 101s
  await seen(page);
  const rec = recordRequests(page);

  // 1. PD01 → the term popover on abscisic acid (ABA in the notes): the ChEBI text verbatim, its id, Learn the concept
  expect(aba.basis).toBe('ontology, verbatim');
  expect(aba.definition_source!.id).toMatch(/^CHEBI:/);
  await go(page, '/path/PD01');
  const term = page.locator('button.bx-term').filter({ hasText: /^(ABA|abscisic acid)$/i }).first();
  await term.click();
  const pop = page.locator(`[data-gloss-popover="${aba.id}"]`);
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(aba.short);
  expect(aba.definition.startsWith(aba.short)).toBe(true); // the short text is the record's own first sentence
  await expect(pop.locator('[data-basis]')).toContainText(`definition, verbatim · ${aba.definition_source!.label} (${aba.definition_source!.id})`);
  await expect(pop.locator('[data-learn-concept]')).toHaveText('Learn the concept');

  // 2. Learn the concept → From stimulus to response, its prerequisite linked; the ABA paragraph cites [66] and [67]
  await pop.locator('[data-learn-concept]').click();
  const c = cById.get(aba.concept!)!;
  await expect(page).toHaveURL(new RegExp(`#/concepts/${c.id}$`));
  await expect(page.locator('h1')).toHaveText(c.title);
  expect(c.prerequisites).toEqual(['how-a-path-is-curated']);
  await expect(page.getByTestId('prerequisite')).toHaveAttribute('data-concept', c.prerequisites[0]);
  await expect(page.getByTestId('prerequisite')).toContainText(cById.get(c.prerequisites[0])!.title);
  const abaBlock = c.sections.flatMap((s) => s.blocks).find((b) => b.text.includes('abscisic acid (ABA)'))!;
  expect([...new Set(abaBlock.cites)]).toEqual([66, 67]);
  const block = page.locator('[data-block]').filter({ hasText: 'abscisic acid (ABA)' });
  const cites = block.locator('button.bx-cite');
  expect((await cites.allTextContents()).map((t) => t.replace(/\D/g, ''))).toEqual(abaBlock.text.match(/\[(\d+)\]/g)!.map((m) => m.replace(/\D/g, '')));
  for (const n of [66, 67]) {
    const r = refs.find((x) => x.n === n)!;
    expect(r.verified && !!r.abstract, `[${n}] verified with an abstract`).toBe(true);
    await block.locator('button.bx-cite', { hasText: String(n) }).first().click();
    await expect(page.locator(`[data-ref="${n}"][data-verified="true"]`).first()).toBeVisible();
    await page.keyboard.press('Escape');
  }

  // 3. Glossary → 'self-incompatibility': GO:0048544 'recognition of pollen' verbatim, the curator mapping, Used in
  await go(page, '/glossary');
  await page.getByTestId('glossary-search').fill('self-incompatibility');
  const e = page.locator(`[data-glossary-entry="${si.id}"]`);
  await expect(e).toBeVisible();
  const vb = e.locator('[data-glossary-verbatim]');
  await expect(vb.locator('[data-definition]')).toHaveText(si.definition);
  await expect(vb.locator('[data-basis]')).toContainText(`definition, verbatim · ${si.definition_source!.label} (${si.definition_source!.id}`);
  await expect(vb.locator('[data-basis]')).toContainText(`retrieved ${String(si.definition_source!.retrieved_on).slice(0, 10)}`);
  expect(si.definition_source!.id).toBe('GO:0048544');
  expect(si.definition_source!.label).toBe('recognition of pollen');
  await expect(vb.locator('[data-basis]')).toContainText(si.definition_source!.mapping!);
  expect(si.definition_source!.mapping).toBe("curator mapping from 'Self-incompatibility'");
  await expect(vb.locator(`a[href="${si.definition_source!.source}"]`)).toContainText(si.definition_source!.id);
  const used = await e.locator('[data-used-in-paths] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')!.replace('#/path/', '')));
  expect(used).toEqual(si.used_in!.paths);
  expect(used.length).toBeGreaterThan(0);
  for (const pid of used) expect(paths.find((p) => p.path_id === pid)!.perception_branch).toBe('Self/non-self');

  // 4. a structure badge marked predicted links to Experimental and predicted structures
  const predicted = index.find((m) => m.featured?.source_db === 'AlphaFoldDB')!;
  await go(page, `/molecules/${predicted.id}`);
  const badge = page.locator('[data-concept-link="computed_badge"]').first();
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page).toHaveURL(new RegExp(`#/concepts/${SLOTS.computed_badge}$`));
  await expect(page.locator('h1')).toHaveText(cById.get('experimental-vs-predicted')!.title);

  // must_not: a definition reworded; a glossary or concept page with a link that goes nowhere; an uncited science sentence
  for (const g of glossary.filter((x) => x.basis === 'ontology, verbatim')) expect(PACK('glossary.yaml').find((y: any) => y.id === g.id).definition, g.id).toBe(g.definition);
  for (const cc of concepts) for (const b of cc.sections.flatMap((s) => s.blocks)) if (!b.framing) expect(b.cites.length, `${cc.id}: ${b.text.slice(0, 50)}`).toBeGreaterThan(0);
  for (const from of ['/glossary', ...concepts.map((x) => `/concepts/${x.id}`)]) {
    await go(page, from);
    const hrefs = await page.locator('main a[href^="#/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')!.split('#').slice(0, 2).join('#')))]);
    for (const h of hrefs) {
      await go(page, h.slice(1));
      await expect(page.locator('h1').first(), `${from} → ${h}`).not.toHaveText(/not found/i);
    }
  }
  expect(rec.foreign(ORIGIN).map((r) => r.url())).toEqual([]);
});

test('w13 core gap — the term popover itself shows the source link and retrieval date', async ({ page }) => {
  coreGap('perception-core: the UI-32 term popover for an `ontology, verbatim` entry shows its definition_source link and retrieved_on (w13 step 1); 0.3.0 shows the id and label in the popover, and the link and date one click away in the glossary entry');
  await seen(page);
  await go(page, '/path/PD01');
  await page.locator('button.bx-term').filter({ hasText: /^(ABA|abscisic acid)$/i }).first().click();
  const pop = page.locator(`[data-gloss-popover="${aba.id}"]`);
  await expect(pop.locator(`a[href="${aba.definition_source!.source}"]`)).toBeVisible({ timeout: 3_000 });
  await expect(pop).toContainText(String(aba.definition_source!.retrieved_on).slice(0, 10), { timeout: 3_000 });
});
