# Plant Perception Pathways

How plants sense their world — light, gravity, touch, temperature, water, nutrients, microbes, herbivores and chemical
cues — mapped as pathways from stimulus to receptor, cascade, signal route, integration and response, with the
molecules involved, their 3D structures and the evidence for each step. *Arabidopsis thaliana* first; senses
Arabidopsis lacks are included with their evidence species labelled (🌱), and contested senses are labelled contested.

A static, on-device web app (Actualizer `workbench`, safety profile `general`, delivery `pages`). Live at
<https://danieladamek.github.io/plant-perception-pathways/>. Everything ships in `dist/`: no runtime fetches, no telemetry, no account. My maps and the notepad stay in this browser.

**Data:** content pack 0.2.1 (`content-pack/`, as of 2026-11-24), curated by Daniel Adamek. Verified at abstract level,
not full text; not peer reviewed. The app adds no facts: gaps render as `TODO(author)` and are listed on Methods.

## Quick start (local)

**The shared core is a local dependency.** `package.json` installs `@actualizer/perception-core` from
`../perception-pathways-explorer/packages/perception-core` at tag `perception-core-v0.3.0`, so a fresh clone needs that
folder beside it (Perception Pathways Explorer checked out at that tag, as a sibling of this folder) before `npm ci`.

Needs **Node 22 or newer** (`.nvmrc`, `engines`): Mol\* 5.13 requires it. On a Mac with Homebrew,
`brew install node@22` installs it beside another Node; put `/opt/homebrew/opt/node@22/bin` first on `PATH` for this app.

```bash
npm ci
npm run build
npm run preview -- --port 4201 --strictPort
```

Open <http://localhost:4201/>. `npm run build` runs the content build (`npm run build:content`) first.

`npm run dev` serves with hot reload on the same port. In dev and preview only, the notepad also autosaves to
`notes/notepad.md` through a loopback-only endpoint; a built `dist/` served anywhere else has no such endpoint.

## How it is built

- **A host of `@actualizer/perception-core` 0.3.0** (the UI shared with Perception Pathways Explorer). This app supplies
  only the pack (its content build's JSON), its theme, its storage namespace (`plant-perception-pathways`) and its
  interface copy (`src/host-strings.ts`), and, in `src/main.tsx`, the Greenhouse mark for the core's header `logo` slot
  and the four 101 placements (`conceptLinks`, app-methods §12.2). Modules: none (no atlas, no vagus lens). No core
  component is copied or forked.
- **Core install: local path, for now** (Daniel, 2026-11-19):
  `"@actualizer/perception-core": "file:../perception-pathways-explorer/packages/perception-core"`, installed as a copy
  (`.npmrc`: `install-links=true`), so nothing is written to the PPE folder. The tag `perception-core-v0.3.0`
  (`c0d20b0`) is local only; a unit test checks that the installed `src/` is byte-identical to it. **A URL or registry install replaces this one line later**, e.g.
  `"github:danieladamek/perception-pathways-explorer#perception-core-v0.3.0"` with a workspace path or an `overrides`
  entry pointing at `packages/perception-core` (see the core's README), or a GitHub Packages version.
- **Theme:** Greenhouse Explorer's (`src/index.css`, `tailwind.config.js`) at greenhouse-explorer `32a18ad`, with the
  AA-corrected values (muted `#5f5442`, accent `#2d6848`, amber `#924817`) and six stage tokens, each ≥ 4.5:1 against
  its node label in light and dark. The 16 branches take the core's categorical tokens `--cat-1`…`--cat-16` (then
  `--br-fallback`), each ≥ 4.5:1 on both papers in light and dark. Fraunces, Source Sans 3 and JetBrains Mono are bundled with fontsource and loaded
  with Greenhouse's deferred-font pattern (`src/lib/fonts.ts`). The Greenhouse Explorer mark and brand files in
  `public/brand/` are byte-for-byte copies (a unit test compares sha256 with the source).
- **Canvas library:** Cytoscape.js with ELK (Layered) and fCoSE (Organic) layouts, and Mol* for 3D structures — both
  inside perception-core. Structures load only from the bundled files in `public/structures/` (sha256-checked).
- **Content build** (`scripts/build-content.ts`): zod schemas mirroring `tools/validate_pack.py` and
  `tools/validate_extension.py`, every cross-reference resolved, the safety lints (`safety.yaml → app_lints`) over every
  rendered pack string, `src/data/*.json`, `public/provenance.json`, `public/staleness.json`, `public/freshness.json`
  and `public/changes.json`. Pack 0.2's glossary and 101s are built with the core's own `glossary-match` ("Used in")
  and `concepts-build`; ontology definitions are quoted verbatim and never linted or reworded. One adapter remains:
  the pack's `other_species` / `non_reference` badge strings are also emitted under the keys the core reads
  (`<model label>_only`, `non_<reference label>`). Problems go to
  `content-pack/BUILD-ERRORS.md` and the Methods page; a string that trips a lint is withheld, never reworded.

## Checks

```bash
npm run validate:pack
```

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run lint:dist
```

```bash
npm run lighthouse
```

- `npm test` (Vitest): schemas (one broken fixture per rule), the goldens from `app-methods.md`, a hand-written
  plant fixture for the navigator derivation (`tests/fixtures/plant-tiny.ts`), storage and export/import, brand
  sha256, stage- and branch-token contrast, the installed core against its tag.
- `npm run test:e2e` (Playwright, its own preview on :4221): the safety suite (`tests/safety/`), one walkthrough per
  scenario (`tests/walkthroughs/`), smoke (every route, dark mode, 375 px, keyboard paths, axe AA, parity screenshots)
  and perception-core's own harness at the consumed version (`tests/core/`, :4231, built into `test-results/`).
- `npm run lighthouse` needs `npm run preview` on :4201.

Expectations perception-core 0.3.0 cannot yet meet are written as `test.fail` with a `core-gap` annotation naming the
proposed core item; they turn red the day the core meets them. With 0.3.0 one remains (w13: the term popover shows
the source link and retrieval date only in the glossary entry, not in the popover itself).

## Publishing (GitHub Pages)

Delivery is `pages` (Daniel, 2026-11-24; pack 0.2.1). The public repo is
[danieladamek/plant-perception-pathways](https://github.com/danieladamek/plant-perception-pathways), and the site is
<https://danieladamek.github.io/plant-perception-pathways/>, served from the `gh-pages` branch at `/`. It is **built on
this Mac**. There is no Actions workflow, because CI cannot install the core's local `file:` dependency.

To republish after a change, starting from a committed tree:

```bash
gh auth status
```

```bash
npm run check
```

```bash
npm run deploy:pages
```

`npm run deploy:pages` (`scripts/deploy-pages.ts`) runs these steps:
1. Builds with `BASE_PATH=/plant-perception-pathways/`. That build keeps notepad notes on the device only, because
   Pages has no loopback `/__local/notes` endpoint.
2. Writes `404.html` and `.nojekyll`.
3. Checks that every URL the HTML, CSS and JS name resolves under the base, including every structure file and font.
4. Commits `dist/` to `gh-pages` through a temporary worktree and pushes it.
5. Rebuilds at base `/`, so `npm run preview -- --port 4201 --strictPort` keeps serving the local app.

`npm run deploy:pages -- --no-push` stops after the checks. Run `npm run build` afterwards to restore the local build.

To check the live site, run the browser suite against it (smoke, safety, walkthroughs; the core harness is skipped):

```bash
PPP_BASE_URL=https://danieladamek.github.io/plant-perception-pathways/ npx playwright test --reporter=line
```

Rollback points: tag `pre-pages` (the last local-only build) and tag `demo-0.1.2`.
