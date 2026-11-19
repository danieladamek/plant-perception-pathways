import { expect, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import yaml from 'js-yaml';
import { PACK_SCHEMA } from '../scripts/yaml-schema';
import { lintHits, type Lint } from '../scripts/lint';

export const NS = 'plant-perception-pathways';
export const PORT = Number(process.env.PPP_PORT ?? 4221);
export const ORIGIN = `http://localhost:${PORT}`;
export const PACK = (f: string) => yaml.load(fs.readFileSync(`content-pack/${f}`, 'utf8'), { schema: PACK_SCHEMA }) as any;
export const LINTS = PACK('safety.yaml').app_lints as Lint[];

/** G2/H2 request recorder: every request after load; non-same-origin requests are violations. */
export function recordRequests(page: Page) {
  const reqs: Request[] = [];
  page.on('request', (r) => reqs.push(r));
  return {
    all: () => reqs,
    foreign: (origin = ORIGIN) => reqs.filter((r) => !r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')),
    containing: (s: string) => reqs.filter((r) => r.url().includes(s) || (r.postData() ?? '').includes(s) || JSON.stringify(r.headers()).includes(s)),
  };
}

/** Suppress the first-run notice (tested on its own in the safety suite); start with an empty notepad. */
export async function seen(page: Page) {
  await page.route('**/__local/notes', (r) => (r.request().method() === 'GET' ? r.fulfill({ json: { ok: true, state: null } }) : r.continue()));
  await page.addInitScript((ns) => {
    try {
      localStorage.setItem(`${ns}:notice-seen`, '1');
    } catch {
      /* ignore */
    }
  }, NS);
}

export async function go(page: Page, hash: string) {
  await page.goto(`/#${hash}`);
  await expect(page.locator('h1').first()).toBeVisible();
}

/** Visible text of the page (what a reader sees). */
export const pageText = (page: Page) => page.evaluate(() => document.body.innerText);

/** the app lints on what the reader sees, with verbatim-source blocks (UI-31) left out */
export async function lintPage(page: Page): Promise<string[]> {
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.setAttribute('open', '')));
  // UI-31: text quoted verbatim from a named source, in a block that says so, is not the app's prose
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-verbatim-source]').forEach((el) => (el.style.display = 'none')));
  const text = await pageText(page);
  await page.evaluate(() => document.querySelectorAll<HTMLElement>('[data-verbatim-source]').forEach((el) => (el.style.display = '')));
  return lintHits(text, LINTS).map((h) => `${h.lint}: ${h.phrase}`);
}

export const ROUTES = [
  '/', '/navigator', '/tree', '/path/PD01', '/path/PW01', '/shared', '/evidence', '/molecules', '/molecules?tab=small', '/molecules/sm/CID5280896',
  '/molecules/UVR8', '/molecules/RIN4', '/structures/4D9S', '/interactions', '/maps', '/references', '/glossary', '/methods', '/about', '/notes',
];
