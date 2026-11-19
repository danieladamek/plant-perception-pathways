/**
 * Static dist checks (pattern from PPE's scripts/lint-dist.ts) (SAFETY G5; safety.yaml app_lints on the shipped HTML). The rendered text of every route and
 * entity page is linted by tests/safety/general.spec.ts; this covers what ships before any script runs.
 */
import fs from 'node:fs';
import yaml from 'js-yaml';
import { lintHits } from './lint';

const dist = process.argv[2] ?? 'dist';
const safety = yaml.load(fs.readFileSync('content-pack/safety.yaml', 'utf8')) as any;
const errs: string[] = [];
for (const f of ['index.html', '404.html']) {
  const html = fs.readFileSync(`${dist}/${f}`, 'utf8');
  if (/<(script|link)[^>]+(src|href)="https?:\/\//.test(html)) errs.push(`${f}: external script or stylesheet`);
  const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
  for (const h of lintHits(text, safety.app_lints)) errs.push(`${f}: ${h.lint} lint — ${h.phrase}`);
  if (!/<title>[^\n<]+<\/title>/.test(html)) errs.push(`${f}: <title> must stay on one line`);
}
const js = fs.readdirSync(`${dist}/assets`).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(`${dist}/assets/${f}`, 'utf8')).join('\n');
for (const host of ['google-analytics.com', 'googletagmanager.com', 'plausible.io', 'sentry.io', 'segment.io', 'mixpanel.com', 'hotjar.com', 'fonts.googleapis.com', 'fonts.gstatic.com']) if (js.includes(host)) errs.push(`bundle names ${host}`);
for (const f of fs.readdirSync(`${dist}/structures`, { recursive: true }) as string[]) if (!fs.existsSync(`content-pack/structures/${f}`)) errs.push(`dist/structures/${f} is not a pack file`);
console.log(errs.length ? errs.join('\n') : `lint-dist: ${dist} clean`);
process.exit(errs.length ? 1 : 0);
