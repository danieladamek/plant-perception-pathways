/** Lighthouse gate (KICKOFF §5): Accessibility 100 on / and the navigator; Performance ≥ 90 on /. Needs `npm run preview` on :4201 (PPP_URL to override). */
import fs from 'node:fs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';

const BASE = process.env.PPP_URL ?? 'http://localhost:4201/';
const targets: [string, string, string[]][] = [
  ['home', BASE, ['performance', 'accessibility']],
  ['navigator', `${BASE}#/navigator`, ['accessibility']],
];
const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
const out: Record<string, Record<string, number>> = {};
for (const [name, url, cats] of targets) {
  const r = await lighthouse(url, { port: chrome.port, onlyCategories: cats, output: 'json', logLevel: 'error' }, name === 'home' ? undefined : ({ extends: 'lighthouse:default', settings: { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1280, height: 900, deviceScaleFactor: 1, disabled: false } } } as any));
  const lhr = r!.lhr;
  out[name] = Object.fromEntries(cats.map((c) => [c, Math.round((lhr.categories[c].score ?? 0) * 100)]));
  for (const a of Object.values(lhr.audits))
    if (a.score !== null && a.score < 1 && (lhr.categories.accessibility?.auditRefs.some((x) => x.id === a.id) || (name === 'home' && ['largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'first-contentful-paint', 'speed-index'].includes(a.id))))
      console.log(`  ${name}: ${a.id} — ${a.title} (${a.displayValue ?? a.score})`);
  console.log(name, out[name]);
}
await chrome.kill();
const ok = out.home.accessibility === 100 && out.navigator.accessibility === 100 && out.home.performance >= 90;
fs.mkdirSync('tests/results', { recursive: true });
fs.writeFileSync('tests/results/lighthouse.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10), ...out, pass: ok }, null, 1) + '\n');
process.exit(ok ? 0 : 1);
