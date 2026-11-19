/**
 * Safety suite, profile `general` (docs/SAFETY.md §1) plus this app's invariants (KICKOFF §1, §8.6; safety.yaml).
 * One describe per invariant.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { go, lintPage, NS, ORIGIN, PACK, recordRequests, ROUTES, seen } from '../helpers';

const safety = PACK('safety.yaml');
const manifest = PACK('manifest.yaml');
const strings = PACK('ui-strings.yaml');

test.describe('G1 nothing invented: gaps render as gap cards and TODO(author)', () => {
  test('PL07: its two null stages are gap cards; the header says 2 gaps', async ({ page }) => {
    await seen(page);
    await go(page, '/path/PL07');
    await expect(page.getByTestId('gap-count')).toHaveText('2 gaps');
    await expect(page.locator('[data-stage="signal_route"][data-gap]')).toContainText(strings.gaps.card);
    await expect(page.locator('[data-stage="integration"][data-gap]')).toContainText(strings.gaps.card);
  });
  test('Methods lists every todo.yaml item as TODO(author)', async ({ page }) => {
    await seen(page);
    await go(page, '/methods');
    const n = PACK('todo.yaml').length;
    await expect(page.getByTestId('todo-list').locator('[data-todo]')).toHaveCount(n + 2); // + the two withheld context-note passages
  });
});

test.describe('G2 no runtime content fetches', () => {
  test('every route, the Mol* viewer and the navigator canvas request only this origin', async ({ page }) => {
    test.setTimeout(240_000);
    await seen(page);
    const rec = recordRequests(page);
    for (const r of [...ROUTES, '/molecules/PHOT1', '/molecules/sm/CID643976', '/navigator?path=PD01']) {
      await go(page, r);
      await page.waitForLoadState('networkidle');
    }
    await page.waitForSelector('[data-viewer-status="ready"]', { timeout: 30_000 }).catch(() => {});
    expect(rec.foreign().map((r) => r.url())).toEqual([]);
    // structure files come from this origin's /structures/
    for (const r of rec.all().filter((x) => /\.(bcif|cif|pdb|sdf)(\?|$)/.test(x.url()))) expect(r.url()).toMatch(new RegExp(`^${ORIGIN}/structures/`));
  });
});

test.describe('G2/H2 nothing typed into My maps or the notepad leaves the browser', () => {
  test('a sentinel typed into every map field and a note appears in no request', async ({ page }) => {
    await seen(page);
    const rec = recordRequests(page);
    const S = 'SENTINEL-7f3a-do-not-send';
    await go(page, '/maps');
    await page.getByTestId('new-map').click();
    await page.getByLabel('Map name').fill(`${S} map`);
    await page.getByTestId('free-node').fill(`${S} node`);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('free-node').fill(`${S} node 2`);
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('link-from').selectOption({ label: `${S} node` });
    await page.getByTestId('link-to').selectOption({ label: `${S} node 2` });
    await page.getByTestId('link-submit').click();
    await page.getByTestId('override-reason').fill(`${S} reason`);
    await page.getByTestId('override-confirm').click();
    await page.getByTestId('map-list-view').click();
    await page.getByLabel(`Note on ${S} node`, { exact: true }).fill(`${S} note`);
    // the notepad
    await go(page, '/path/PD01');
    await page.getByTestId('note-page').click();
    await page.getByTestId('notepad-drawer').getByTestId('note-body').first().fill(`${S} notepad`);
    await page.keyboard.press('Escape');
    for (const r of ['/navigator', '/molecules/UVR8', '/evidence', '/maps']) await go(page, r);
    await page.waitForTimeout(2000); // the notepad's loopback autosave keeps the network busy, so no networkidle here
    // the dev/preview server's loopback notes autosave (UI-18) is the one allowed same-origin path; it never ships in dist
    const carrying = rec.containing('SENTINEL').filter((r) => !(r.url() === `${ORIGIN}/__local/notes` && r.method() === 'PUT'));
    expect(carrying.map((r) => r.url())).toEqual([]);
    expect(rec.foreign()).toHaveLength(0);
    expect(page.url()).not.toContain('SENTINEL');
  });
});

test.describe('G3 provenance visible', () => {
  for (const r of ['/', '/about', '/methods'])
    test(`as_of on ${r}`, async ({ page }) => {
      await seen(page);
      await go(page, r);
      await expect(page.locator('[data-asof]').first()).toContainText(String(manifest.as_of));
    });
  test('every path shows tier and species in the evidence table', async ({ page }) => {
    await seen(page);
    await go(page, '/evidence');
    await expect(page.locator('[data-row]')).toHaveCount(67);
    await expect(page.locator('[data-row] [data-testid="tier"]')).toHaveCount(67);
    await expect(page.locator('[data-row] [data-species]')).toHaveCount(67);
  });
});

test.describe('G4 heuristics carry their labels', () => {
  test('n paths and curator mapping labels render where used; Methods lists the heuristics', async ({ page }) => {
    await seen(page);
    await go(page, '/molecules/PHOT1');
    await expect(page.getByTestId('n-paths')).toContainText(strings.labels.n_paths);
    await expect(page.locator('[data-curator-mapping]').first()).toHaveText(strings.badges.curator_mapping);
    await go(page, '/methods');
    await expect(page.getByTestId('heuristics').locator('[data-heuristic]')).toHaveCount(5);
    for (const l of [strings.labels.n_paths, strings.labels.computed_contacts, strings.badges.curator_mapping]) await expect(page.getByTestId('heuristics')).toContainText(l);
  });
});

test.describe('G5 no telemetry, no third-party assets', () => {
  test('dist/index.html has no external script or link; the bundle names no analytics host', () => {
    const html = fs.readFileSync('dist/index.html', 'utf8');
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)="https?:\/\//);
    const js = fs.readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
    for (const host of ['google-analytics.com', 'googletagmanager.com', 'plausible.io', 'sentry.io', 'segment.io', 'mixpanel.com', 'hotjar.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net/npm/molstar']) expect(js, host).not.toContain(host);
    const css = fs.readdirSync('dist/assets').filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(`dist/assets/${f}`, 'utf8')).join('\n');
    expect(css).not.toMatch(/url\(["']?https?:/);
  });
});

test.describe('Clear my data', () => {
  test('create data, clear it, reload: storage is empty', async ({ page }) => {
    await seen(page);
    await go(page, '/maps');
    await page.getByTestId('new-map').click();
    await expect(page.getByTestId('map-list').locator('li')).toHaveCount(1);
    page.once('dialog', (d) => d.accept());
    await page.getByTestId('clear-data').click();
    await expect(page.getByTestId('map-list')).toContainText('No maps yet.');
    await page.reload();
    await expect(page.getByTestId('map-list')).toContainText('No maps yet.');
    const left = await page.evaluate(async (ns) => {
      const ls = Object.keys(localStorage).filter((k) => k.startsWith(`${ns}:`));
      const req = indexedDB.open(ns);
      const keys: string[] = await new Promise((res) => {
        req.onsuccess = () => {
          try {
            const g = req.result.transaction('workspace', 'readonly').objectStore('workspace').getAllKeys();
            g.onsuccess = () => res(g.result.map(String));
            g.onerror = () => res([]);
          } catch {
            res([]);
          }
        };
        req.onerror = () => res([]);
      });
      return { ls, keys };
    }, NS);
    expect(left.ls.filter((k) => !k.endsWith('notice-seen'))).toEqual([]);
    expect(left.keys).toEqual([]);
  });
});

test.describe('The notice (safety.yaml) on first run, Home and About', () => {
  test('first run shows the notice; Home and About show it', async ({ page }) => {
    await go(page, '/');
    const head = safety.notice.trim().replace(/\s+/g, ' ').slice(0, 60);
    await expect(page.getByTestId('first-run-notice')).toContainText(head);
    await expect(page.getByTestId('home-notice')).toContainText(head);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.reload();
    await expect(page.getByTestId('first-run-notice')).toHaveCount(0);
    await go(page, '/about');
    await expect(page.getByTestId('about-notice')).toContainText(head);
  });
});

for (const lint of safety.app_lints as { id: string }[]) {
  test.describe(`app lint: ${lint.id}`, () => {
    test(`no ${lint.id} phrase in the rendered text of any route or entity page`, async ({ page }) => {
      test.setTimeout(400_000);
      await seen(page);
      const routes = [...ROUTES, ...PACK('paths.yaml').paths.map((p: any) => `/path/${p.path_id}`), ...PACK('molecules.yaml').molecules.map((m: any) => `/molecules/${encodeURIComponent(m.id)}`)];
      const hits: string[] = [];
      for (const r of routes) {
        await page.goto(`/#${r}`);
        await page.locator('h1').first().waitFor();
        for (const h of await lintPage(page)) if (h.startsWith(`${lint.id}:`)) hits.push(`${r} → ${h}`);
      }
      expect(hits).toEqual([]);
    });
  });
}

test.describe('§8.6 things that must not happen', () => {
  test('no predicted model without its badge', async ({ page }) => {
    test.setTimeout(400_000);
    await seen(page);
    for (const s of PACK('structures.yaml').structures.filter((s: any) => s.kind === 'predicted')) {
      await go(page, `/molecules/${encodeURIComponent(s.molecules[0])}`);
      await expect(page.locator('[data-badge="predicted"]').first(), s.molecules[0]).toBeVisible();
    }
  });
  test('no candidate (verified: false) reference shown as evidence', async ({ page }) => {
    await seen(page);
    await go(page, '/references');
    await expect(page.getByTestId('refs-verified').locator('[data-verified="false"]')).toHaveCount(0);
    await expect(page.getByTestId('refs-verified').locator('[data-ref]')).toHaveCount(152);
  });
  test('no atlas, no vagus lens, no greenhouse content or grow log', async ({ page }) => {
    await seen(page);
    await go(page, '/navigator');
    await expect(page.locator('[data-lens="vagus"]')).toHaveCount(0);
    await expect(page.locator('[data-lens="atlas"]')).toHaveCount(0);
    for (const r of ['/atlas', '/vagus', '/grow-log', '/plants']) {
      await page.goto(`/#${r}`);
      await expect(page.locator('h1').first()).toContainText(/not found/i);
    }
  });
  test('no molecule node at a stage other than its own (navigator canvas)', async ({ page }) => {
    await seen(page);
    await go(page, '/navigator');
    const canvas = page.getByTestId('navigator-canvas');
    await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 45_000 });
    const bad = await canvas.evaluate((el: any) => el._cy.nodes().filter((n: any) => n.data('kind') === 'molecule' && n.data('stage') !== 'receptor').map((n: any) => n.id()));
    expect(bad).toEqual([]);
  });
  test('no runtime fetch from Mol*: a structure loads from the bundled file only', async ({ page }) => {
    await seen(page);
    const rec = recordRequests(page);
    await go(page, '/structures/4D9S');
    await expect(page.locator('[data-viewer-status="ready"]')).toBeVisible({ timeout: 45_000 });
    expect(rec.foreign()).toHaveLength(0);
    expect(rec.all().some((r) => r.url() === `${ORIGIN}/structures/4D9S.bcif`)).toBe(true);
  });
  test('no local copy or fork of a core component (src/ holds only the entry, strings, fonts and data)', () => {
    const src = (fs.readdirSync('src', { recursive: true }) as string[]).filter((f) => /\.(tsx?|css)$/.test(f)).sort();
    expect(src).toEqual(['host-strings.ts', 'index.css', 'lib/fonts.ts', 'main.tsx']);
  });
});
