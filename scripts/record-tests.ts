/** Summarise the last full Playwright run (tests/results/playwright.json) and the Lighthouse gate into
 *  tests/results/summary.json, which the content build copies into provenance.json (ACTION-SPEC §6.6). */
import fs from 'node:fs';
const r = JSON.parse(fs.readFileSync('tests/results/playwright.json', 'utf8'));
const by: Record<string, { passed: number; failed: number; expected_failures: number; skipped: number; core_gaps: string[] }> = {};
const walk = (s: any, file: string) => {
  for (const sp of s.specs ?? [])
    for (const t of sp.tests) {
      const k = (sp.file ?? file).split('/')[0] === 'core' ? 'core-harness' : (sp.file ?? file).split('/')[0];
      const b = (by[k] ??= { passed: 0, failed: 0, expected_failures: 0, skipped: 0, core_gaps: [] });
      const st = t.results.at(-1)?.status;
      if (t.expectedStatus === 'failed' && st === 'failed') {
        b.expected_failures++;
        for (const a of t.annotations ?? []) if (a.type === 'core-gap' || a.type === 'pack-gap') b.core_gaps.push(`${sp.title}: ${a.description}`);
      } else if (st === 'passed') b.passed++;
      else if (st === 'skipped') b.skipped++;
      else b.failed++;
    }
  for (const c of s.suites ?? []) walk(c, s.file ?? file);
};
for (const s of r.suites) walk(s, s.file);
const lh = fs.existsSync('tests/results/lighthouse.json') ? JSON.parse(fs.readFileSync('tests/results/lighthouse.json', 'utf8')) : null;
const summary = { date: new Date().toISOString().slice(0, 10), suites: by, lighthouse: lh };
fs.writeFileSync('tests/results/summary.json', JSON.stringify(summary, null, 1) + '\n');
for (const [k, v] of Object.entries(by)) console.log(k.padEnd(14), `passed ${v.passed} · failed ${v.failed} · expected failures ${v.expected_failures} · skipped ${v.skipped}`);
