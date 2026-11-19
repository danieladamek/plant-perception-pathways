// The content build's schemas and cross-file rules: a pack fixture with one error per rule fails with the right message
// (KICKOFF §5). Each case copies the real pack to a temp folder, breaks exactly one thing and runs build-content --check.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const PACK = path.join(ROOT, 'content-pack');
function run(mutate: (dir: string) => void) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ppp-pack-'));
  for (const f of fs.readdirSync(PACK)) {
    if (f === 'structures') fs.symlinkSync(path.join(PACK, f), path.join(dir, f));
    else if (fs.statSync(path.join(PACK, f)).isFile()) fs.copyFileSync(path.join(PACK, f), path.join(dir, f));
  }
  mutate(dir);
  const r = spawnSync('npx', ['tsx', 'scripts/build-content.ts', '--pack', dir, '--check'], { cwd: ROOT, encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  return { code: r.status, out: r.stdout + r.stderr };
}
const edit = (dir: string, f: string, from: string | RegExp, to: string) => {
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, 'utf8');
  const t = s.replace(from, to);
  if (t === s) throw new Error(`fixture edit did not apply in ${f}: ${from}`);
  fs.writeFileSync(p, t);
};

describe('the unmodified pack passes --check', () => {
  it('0 errors besides the lint withholdings', () => {
    const r = run(() => {});
    expect(r.out).not.toMatch(/ERROR (?!.*withheld)/);
  }, 60_000);
});

const CASES: [string, (d: string) => void, RegExp][] = [
  ['a bad tier', (d) => edit(d, 'paths.yaml', 'transducer_tier: B1', 'transducer_tier: B9'), /ERROR paths\.yaml\/paths\.0\.transducer_tier — bad tier/],
  ['a row that is not curated', (d) => edit(d, 'paths.yaml', 'row_status: curated', 'row_status: candidate'), /only curated rows ship/],
  ['a path ref that does not exist', (d) => edit(d, 'paths.yaml', /refs:\n  - 1\n/, 'refs:\n  - 9999\n'), /ERROR paths\/PL01 — ref 9999 not found/],
  ['a molecule without a stage (never rely on the core default)', (d) => edit(d, 'molecules.yaml', /\n  stage: receptor\n/, '\n'), /molecules\.yaml\/molecules\.\d+\.stage — Required/],
  ['a molecule at an unknown stage', (d) => edit(d, 'molecules.yaml', /\n  stage: receptor\n/, '\n  stage: ganglion\n'), /stage ganglion is not a stage kind/],
  ['a mapping not labelled as a curator mapping', (d) => edit(d, 'molecules.yaml', /mapping: '?curator mapping:/, 'mapping: x'), /mapping must be labelled a curator mapping/],
  ['a structure sha256 mismatch', (d) => edit(d, 'structures.yaml', /sha256: [0-9a-f]{64}/, `sha256: ${'ab'.repeat(32)}`), /sha256 mismatch — file not copied/],
  ['a hierarchy leaf naming no path', (d) => edit(d, 'hierarchy.yaml', '- PL01\n', '- PL99\n'), /path PL99 not found/],
  ['a hub that is not a molecule', (d) => edit(d, 'hubs.yaml', '- molecule: BCA1', '- molecule: NOPE1'), /hubs\/NOPE1 — not a molecule/],
  ['a malformed Plant Ontology id', (d) => edit(d, 'anatomy.yaml', /id: PO:\d{7}/, 'id: PO:12'), /bad ontology id/],
  ['a stage colour that is not a CSS variable', (d) => edit(d, 'manifest.yaml', 'colour: --stage-stimulus', 'colour: red'), /colour must name a CSS variable/],
  ['a chromophore hidden by default', (d) => edit(d, 'small-molecules.yaml', /(classes:\n  - chromophore\n[\s\S]*?hidden_by_default: )false/, '$1true'), /chromophore is hidden by default/],
  ['an unverified reference cited by a path', (d) => edit(d, 'references.yaml', 'verified: true', 'verified: false'), /is not verified \(it backs nothing/],
  ['a safety profile that differs from the manifest', (d) => edit(d, 'safety.yaml', 'profile: general', 'profile: health'), /profile health differs from manifest general/],
];
describe('one error per rule, with the right message', () => {
  for (const [name, mutate, msg] of CASES)
    it(name, () => {
      const r = run(mutate);
      expect(r.code).not.toBe(0);
      expect(r.out).toMatch(msg);
    }, 60_000);
});
