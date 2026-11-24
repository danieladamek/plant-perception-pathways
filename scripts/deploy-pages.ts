/**
 * deploy:pages (K41): build on this Mac for GitHub Pages and publish dist/ to the gh-pages branch. There is no CI build:
 * the core is a local file: dependency that CI cannot install.
 *
 *   npm run deploy:pages              build, check, publish, then restore the local (base /) build
 *   npm run deploy:pages -- --no-push build and check only (dist/ is left as the Pages build until you rebuild)
 *
 * 1. BASE_PATH=/plant-perception-pathways/ npm run build (content build, tsc, vite build, 404.html)
 * 2. dist/.nojekyll
 * 3. every URL that index.html, 404.html, the CSS and the JS name under the base resolves to a file in dist/; every
 *    content-pack structure file and every bundled font is there
 * 4. dist/ → gh-pages, through a temporary git worktree (one commit per deploy, naming the main commit)
 * 5. npm run build again at base /, so `npm run preview -- --port 4201 --strictPort` serves the local app
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const BASE = '/plant-perception-pathways/';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const PUSH = !process.argv.includes('--no-push');
const sh = (cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {}) =>
  execFileSync(cmd, args, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...opts.env }, stdio: 'inherit' });
const out = (cmd: string, args: string[], cwd = ROOT) => execFileSync(cmd, args, { cwd, encoding: 'utf8' }).trim();
const fail = (m: string) => {
  console.error(`deploy:pages: ${m}`);
  process.exit(1);
};

// 0. publish only a committed tree (the gh-pages commit names it)
if (PUSH && out('git', ['status', '--porcelain', '--untracked-files=no'])) fail('commit or stash your changes first (the deploy names the main commit)');
const SHA = out('git', ['rev-parse', '--short', 'HEAD']);

// 1–2. build under the base
sh('npm', ['run', 'build'], { env: { BASE_PATH: BASE } });
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// 3. every URL under the base resolves; nothing is rooted outside it
const files = (fs.readdirSync(DIST, { recursive: true }) as string[]).filter((f) => fs.statSync(path.join(DIST, f)).isFile());
const have = new Set(files.map((f) => f.split(path.sep).join('/')));
const problems: string[] = [];
for (const f of ['index.html', '404.html']) {
  const html = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of html.matchAll(/\b(?:src|href|content)="(\/[^"]*)"/g)) {
    const u = m[1];
    if (!u.startsWith(BASE)) problems.push(`${f}: ${u} is outside ${BASE}`);
    else if (!have.has(decodeURI(u.slice(BASE.length).split(/[?#]/)[0]))) problems.push(`${f}: ${u} is not in dist/`);
  }
}
for (const f of files.filter((x) => /\.(css|js)$/.test(x))) {
  const text = fs.readFileSync(path.join(DIST, f), 'utf8');
  for (const m of text.matchAll(new RegExp(`${BASE.replace(/\//g, '\\/')}((?:assets|structures|brand|fonts)\\/[\\w./%-]+?)(?=["'\`)?#\\s])`, 'g')))
    if (!have.has(decodeURI(m[1]))) problems.push(`${f}: ${BASE}${m[1]} is not in dist/`);
  // a root-relative asset URL would miss the base on Pages
  for (const m of text.matchAll(/["'(]\/(assets|structures|brand)\/[\w.-]+/g)) problems.push(`${f}: root-relative ${m[0].slice(1)}`);
}
const structures = (fs.readdirSync(path.join(ROOT, 'content-pack/structures'), { recursive: true }) as string[]).filter((f) => fs.statSync(path.join(ROOT, 'content-pack/structures', f)).isFile());
for (const f of structures) if (!have.has(`structures/${f.split(path.sep).join('/')}`)) problems.push(`structures/${f} is not in dist/`);
const fonts = files.filter((f) => f.endsWith('.woff2'));
if (!fonts.length) problems.push('no bundled .woff2 font in dist/');
if (!have.has('.nojekyll') || !have.has('404.html')) problems.push('.nojekyll or 404.html missing');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/manifest.json'), 'utf8'));
if (manifest.notes_storage !== 'device') problems.push('the Pages build must keep notes on the device (manifest.notes_storage)');
if (problems.length) fail(`${problems.length} problem(s):\n  ${problems.slice(0, 40).join('\n  ')}`);
console.log(`deploy:pages: ${files.length + 1} files under ${BASE}: ${structures.length} structure files, ${fonts.length} fonts, every reference resolves`);

// 4. dist/ → gh-pages
if (PUSH) {
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'ppp-gh-pages-'));
  try {
    const remote = out('git', ['ls-remote', '--heads', 'origin', 'gh-pages']);
    if (remote) {
      sh('git', ['fetch', 'origin', 'gh-pages']);
      sh('git', ['worktree', 'add', '-B', 'gh-pages', wt, 'origin/gh-pages']);
    } else {
      sh('git', ['worktree', 'add', '--detach', wt]);
      sh('git', ['checkout', '--orphan', 'gh-pages'], { cwd: wt });
    }
    for (const f of fs.readdirSync(wt)) if (f !== '.git') fs.rmSync(path.join(wt, f), { recursive: true, force: true });
    fs.cpSync(DIST, wt, { recursive: true });
    sh('git', ['add', '-A'], { cwd: wt });
    if (out('git', ['status', '--porcelain'], wt)) {
      sh('git', ['commit', '-q', '-m', `Deploy ${SHA} to GitHub Pages (base ${BASE})`], { cwd: wt });
      sh('git', ['push', 'origin', 'gh-pages'], { cwd: wt });
      console.log(`deploy:pages: published ${SHA} as gh-pages ${out('git', ['rev-parse', '--short', 'HEAD'], wt)}`);
    } else console.log('deploy:pages: gh-pages already matches this build; nothing pushed');
  } finally {
    sh('git', ['worktree', 'remove', '--force', wt]);
  }
}

// 5. restore the local build (base /)
if (PUSH) sh('npm', ['run', 'build'], { env: { BASE_PATH: '/' } });
else console.log('deploy:pages: --no-push: dist/ is the Pages build; run `npm run build` to restore the local one');
