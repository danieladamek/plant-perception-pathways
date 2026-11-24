import AxeBuilder from '@axe-core/playwright';
import { test, expect, navSettled } from './_shared';
import { go, NS, ORIGIN, PACK, recordRequests, seen } from '../helpers';
const manifest = PACK('manifest.yaml');

for (const t of ['light', 'dark'] as const)
  test(`w11 — it looks like Greenhouse Explorer (${t})`, async ({ page }) => {
    await seen(page);
    await page.addInitScript(([ns, v]) => localStorage.setItem(`${ns}:theme`, v), [NS, t] as const);
    const rec = recordRequests(page);
    await go(page, '/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'greenhouse');
    const s = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const brand = document.querySelector('header a[href="#/"]')!;
      return {
        bg: css.getPropertyValue('--bx-bg').trim(), accent: css.getPropertyValue('--bx-accent').trim(), muted: css.getPropertyValue('--bx-muted').trim(),
        display: getComputedStyle(document.querySelector('h1')!).fontFamily, body: getComputedStyle(document.body).fontFamily,
        mono: getComputedStyle(document.querySelector('.bx-asof') ?? document.body).fontFamily,
        // the Greenhouse mark in the core's header logo slot (0.3.0): the one image that is displayed in this theme
        mark: [...brand.querySelectorAll<HTMLImageElement>('[data-testid="header-logo"] img')].filter((i) => getComputedStyle(i).display !== 'none').map((i) => i.getAttribute('src')).join(' '),
        wordmark: (brand as HTMLElement).innerText.replace(/\s+/g, ' ').trim(),
      };
    });
    expect(s).toMatchObject(t === 'light' ? { bg: '#efe3c6', accent: '#2d6848', muted: '#5f5442' } : { bg: '#1a1712', accent: '#8fd0a0', muted: '#b8ab94' });
    expect(s.display).toMatch(/Fraunces/);
    expect(s.body).toMatch(/Source Sans 3/);
    expect(s.mark).toBe(t === 'light' ? '/brand/web/mark-64.png' : '/brand/web/mark-dark-64.png');
    expect(s.wordmark).toBe('Plant Perception Pathways');
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // the navigator: six stage colours from the Greenhouse tokens
    await go(page, '/navigator');
    await navSettled(page);
    const fills = await page.evaluate((kinds: string[]) => kinds.map((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim()), manifest.stage_kinds.map((k: any) => k.colour));
    expect(new Set(fills).size).toBe(6);
    // must_not: PPE's colours or fonts; a font or image fetched at runtime
    expect(s.display).not.toMatch(/Iowan Old Style"?,\s*"?Palatino/);
    expect(rec.foreign().map((r) => r.url())).toEqual([]);
    for (const r of rec.all().filter((x) => /\.(woff2?|png|webp|svg)(\?|$)/.test(x.url()))) expect(r.url().startsWith(ORIGIN)).toBe(true);
  });

test('w11 — the lens list is None and Shared hardware only (no Proposed routes lens: the pack has none)', async ({ page }) => {
  await seen(page);
  await go(page, '/navigator');
  const lenses = await page.locator('[data-lens]').evaluateAll((els) => els.map((e) => e.getAttribute('data-lens')));
  // perception-core 0.3.0 names the no-lens choice 'none' (it was '' before 0.3.0)
  expect(lenses).toEqual(['none', 'shared']);
});
