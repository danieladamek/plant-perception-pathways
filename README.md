# Plant Perception Pathways

How plants sense their world — light, gravity, touch, temperature, water, nutrients, microbes, herbivores and chemical
cues — mapped as pathways from stimulus to receptor, cascade, signal route, integration and response, with the
molecules involved, their 3D structures and the evidence for each step. *Arabidopsis thaliana* first; senses
Arabidopsis lacks are included with their evidence species labelled (🌱), and contested senses are labelled contested.

A static, on-device web app (Actualizer `workbench`, safety profile `general`, delivery `local`). Everything ships in
`dist/`: no runtime fetches, no telemetry, no account. My maps and the notepad stay in this browser.

**Data:** content pack 0.1 (`content-pack/`, as of 2026-11-19), curated by Daniel Adamek. Verified at abstract level,
not full text; not peer reviewed. The app adds no facts: gaps render as `TODO(author)` and are listed on Methods.

## Quick start (local)

```bash
npm ci
npm run build
npm run preview -- --port 4201 --strictPort
```

Open <http://localhost:4201/>. `npm run build` runs the content build (`npm run build:content`) first.

`npm run dev` serves with hot reload on the same port. In dev and preview only, the notepad also autosaves to
`notes/notepad.md` through a loopback-only endpoint; a built `dist/` served anywhere else has no such endpoint.

## How it is built

- **A host of `@actualizer/perception-core` 0.1.0** (the UI shared with Perception Pathways Explorer). This app supplies
  only the pack (its content build's JSON), its theme, its storage namespace (`plant-perception-pathways`) and its
  interface copy (`src/host-strings.ts`). Modules: none (no atlas, no vagus lens). No core component is copied or forked.
- **Core install: local path, for now** (Daniel, 2026-11-19):
  `"@actualizer/perception-core": "file:../perception-pathways-explorer/packages/perception-core"`, installed as a copy
  (`.npmrc`: `install-links=true`), so nothing is written to the PPE folder. The tag `perception-core-v0.1.0`
  (`6f5f73d`) is local only. **A URL or registry install replaces this one line later**, e.g.
  `"github:danieladamek/perception-pathways-explorer#perception-core-v0.1.0"` with a workspace path or an `overrides`
  entry pointing at `packages/perception-core` (see the core's README), or a GitHub Packages version.
- **Theme:** Greenhouse Explorer's (`src/index.css`, `tailwind.config.js`) at greenhouse-explorer `32a18ad`, with the
  AA-corrected values (muted `#5f5442`, accent `#2d6848`, amber `#924817`) and six stage tokens, each ≥ 4.5:1 against
  its node label in light and dark. Fraunces, Source Sans 3 and JetBrains Mono are bundled with fontsource and loaded
  with Greenhouse's deferred-font pattern (`src/lib/fonts.ts`). The Greenhouse Explorer mark and brand files in
  `public/brand/` are byte-for-byte copies (a unit test compares sha256 with the source).
- **Canvas library:** Cytoscape.js with ELK (Layered) and fCoSE (Organic) layouts, and Mol* for 3D structures — both
  inside perception-core. Structures load only from the bundled files in `public/structures/` (sha256-checked).
- **Content build** (`scripts/build-content.ts`): zod schemas mirroring `tools/validate_pack.py` and
  `tools/validate_extension.py`, every cross-reference resolved, the safety lints (`safety.yaml → app_lints`) over every
  rendered pack string, `src/data/*.json`, `public/provenance.json`, `public/staleness.json`. Problems go to
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
  sha256, stage-token contrast.
- `npm run test:e2e` (Playwright, its own preview on :4221): the safety suite (`tests/safety/`), one walkthrough per
  scenario (`tests/walkthroughs/`), smoke (every route, dark mode, 375 px, keyboard paths, axe AA, parity screenshots)
  and perception-core's own harness at the consumed version (`tests/core/`, :4231, built into `test-results/`).
- `npm run lighthouse` needs `npm run preview` on :4201.

Expectations perception-core 0.1.0 cannot yet meet are written as `test.fail` with a `core-gap` annotation naming the
proposed core item; they turn red the day the core meets them.

## Publishing this later

Delivery is `local`. If Daniel decides to publish:

1. Check the identity: `gh auth status` shows `danieladamek`.
2. Replace the core's local-path dependency with a URL or registry install (above), so CI can install it.
3. Build for a project site: `BASE_PATH=/plant-perception-pathways/ npm run build` (the `404.html` fallback is written
   by `scripts/postbuild.ts`; routes are hash routes).
4. Create the repo (`gh repo create danieladamek/plant-perception-pathways --public --source . --push`, or `--private`
   with no Pages) and add a `deploy.yml` that runs `npm ci → npm test → npm run build:content → build → deploy-pages`.
5. Re-run the safety suite against the live URL (`PPP_PORT` / `baseURL`).
