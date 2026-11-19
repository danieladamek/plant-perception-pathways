// KICKOFF §8.2: the Greenhouse Explorer brand files are copied byte for byte (sha256 against greenhouse-explorer at
// 32a18ad), and each of the six stage tokens passes AA (4.5:1) against its node label in light and dark.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '../..');
const GX = path.resolve(ROOT, '../greenhouse-explorer');
const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

describe('brand files are greenhouse-explorer public/brand at 32a18ad, byte for byte', () => {
  const files = execFileSync('git', ['-C', GX, 'ls-tree', '-r', '--name-only', '32a18ad', 'public/brand'], { encoding: 'utf8' }).trim().split('\n');
  it('17 files', () => expect(files.length).toBe(17));
  for (const f of files)
    it(f, () => {
      const src = execFileSync('git', ['-C', GX, 'show', `32a18ad:${f}`]);
      expect(sha(fs.readFileSync(path.join(ROOT, f)))).toBe(sha(src));
    });
});

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
describe('stage tokens: AA against the node label (--bx-ink) in light and dark', () => {
  const css = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  const block = (sel: RegExp) => css.match(sel)![1];
  const light = block(/\n:root \{\n  --bx-claim([\s\S]*?)\n\}/);
  const dark = block(/\n\.dark \{\n  --bx-claim([\s\S]*?)\n\}/);
  const ink = { light: css.match(/:root \{[\s\S]*?--bx-ink: (#[0-9a-f]{6})/)![1], dark: css.match(/\.dark \{[\s\S]*?--bx-ink: (#[0-9a-f]{6})/)![1] };
  const manifest = fs.readFileSync(path.join(ROOT, 'content-pack/manifest.yaml'), 'utf8');
  const tokens = [...manifest.matchAll(/colour: (--stage-[\w-]+)/g)].map((m) => m[1]);
  it('the pack names six stage tokens', () => expect(tokens).toEqual(['--stage-stimulus', '--stage-receptor', '--stage-cascade', '--stage-signal_route', '--stage-integration', '--stage-response']));
  for (const [mode, b] of [['light', light], ['dark', dark]] as const)
    for (const t of tokens)
      it(`${t} (${mode})`, () => {
        const v = b.match(new RegExp(`${t}: (#[0-9a-f]{6})`))?.[1];
        expect(v, `${t} defined in ${mode}`).toBeTruthy();
        expect(ratio(v!, ink[mode])).toBeGreaterThanOrEqual(4.5);
      });
  it('the six dark tokens are distinct', () => expect(new Set(tokens.map((t) => dark.match(new RegExp(`${t}: (#[0-9a-f]{6})`))![1])).size).toBe(6));
});

describe('perception-core', () => {
  it('is 0.1.0, the tagged version (local path, KICKOFF §8.1)', () => {
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/@actualizer/perception-core/package.json'), 'utf8')).version).toBe('0.1.0');
    expect(JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).dependencies['@actualizer/perception-core']).toBe('file:../perception-pathways-explorer/packages/perception-core');
  });
  it('no local copy or fork of a core component in src/', () => {
    const src = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }) as string[];
    expect(src.filter((f) => /\.(tsx)$/.test(f))).toEqual(['main.tsx']);
  });
});
