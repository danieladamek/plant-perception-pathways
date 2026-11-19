---
type: kickoff
project: actualizer
app: plant-perception-pathways
template: KICKOFF-TEMPLATE 0.1.2
date: 2026-11-19
---
**Launch:**
```bash
cd ~/Allofit/Projects/actualizer/apps/plant-perception-pathways && claude "Read KICKOFF.md and do exactly what it says."
```

Prerequisites (ACTUALIZER-WORKFLOW U6): the validator passes with 0 errors; the frozen docs are in `apps/plant-perception-pathways/docs/`; the hub and `notes/Scrums/` exist; the port and shortcut are recorded; the K item is `inwork`; and under `pages` or `private`, `gh auth status` shows `danieladamek`.

═══════════════════════════════════════════════════════════════

# KICKOFF — Plant Perception Pathways — how plants sense, from stimulus to receptor to response, with structures and evidence

You are building **Plant Perception Pathways**, a static web app made from an Actualizer action pack. It is a `workbench` app with safety profile **`general`**. You are the build-and-delivery role. The research is done and sits in `content-pack/`. **You add no facts.**

This is a single-shot build. Work through every section in order without stopping for confirmation, and finish with §6 and §7.

## 0. Ground truth: read in this order

1. `docs/ACTION-SPEC.md`: what the app must be. §6 (provenance) and §8 (acceptance) bind you.
2. `docs/SAFETY.md`: the `general` invariants. Each one is a test you write (§5).
3. `docs/ACTION-PACK.md`: the schema of `content-pack/`.
4. `docs/DESIGN-SYSTEM.md`, then `docs/MI-DESIGN-SYSTEM.md`, which it inherits in full. Copy the `bx-` classes verbatim.
5. `docs/SUSTAIN.md` §4: what `/methods` must say about staleness.
6. `content-pack/manifest.yaml`, `audience.yaml`, `scenarios.yaml` (your acceptance tests), `safety.yaml`, then every module file in `manifest.modules`, every file in `manifest.extensions`, `references.yaml`, `ui-strings.yaml` and `todo.yaml` (there is no glossary and no 101 in pack 0.1). For a workbench or planner, also `app-requirements.md` and `app-methods.md`, which are **normative** for the main surface.
7. The contracts: `../../../CLAUDE.md` (vault) and `../../CLAUDE.md` (team), if present. Your scrum note goes in `notes/Scrums/YYMMDD.md` with frontmatter `type: scrum` · `project: actualizer` · `app: plant-perception-pathways` · `date:` · `author: claude-code`. The K item is in `../../notes/Backlog/` with `app: plant-perception-pathways`; set it to `inreview` when you finish.

Reference implementations you may mine for patterns (do **not** copy their data): see §8.7.

## 1. Hard rules

- **Never invent facts.** Every definition, mechanism, grade, reference summary, abstract, help entry and interface claim comes from the pack. Gaps render as amber `TODO(author)` (`.bx-todo`) and are listed on `/methods`.
- **Verbatim fields stay verbatim**: abstracts, and the UniProt, RCSB, AlphaFold DB, PubChem and Plant Ontology fields in `molecules.yaml`, `structures.yaml`, `small-molecules.yaml` and `anatomy.yaml`, each shown with its source and retrieval date. There is no situations module and no classification scheme in this app.
- **Unverified evidence is not evidence.** A link or action that cites a `verified: false` reference is not offered as a suggestion; list it on `/methods`.
- **Heuristics carry their labels** (SAFETY G4) wherever they render.
- **Safety profile `general`:** every invariant in SAFETY §1–§1 is a requirement and a test. In particular:
  - *(general, plus this app)* the app lints in `safety.yaml → app_lints` (internal jargon; centrality wording; contested framing, with quoted abstracts exempt) run over `dist/` text; nothing typed into My maps or the notepad leaves the browser (ACTION-SPEC §4 applies to every workspace); "Clear my data"; the notice from `safety.yaml` on `/about` and first run.
- **No runtime fetches, no telemetry, no third-party runtime assets** (SAFETY G2 and G5). Bundle the fonts or use system fonts.
- **Fail loudly in the content build.** Write errors to `content-pack/BUILD-ERRORS.md`, surface them on `/methods`, and build the rest. Never "fix" the pack.
- **Delivery is `local`** and is not yours to change. Under `local`, there is no remote.
- **GitHub identity:** `danieladamek`, checked with `gh auth status` before any push.
- Touch nothing outside this folder except the K item's `state`. In particular, **do not edit `../perception-pathways-explorer/`**, the core included (§8.1).

## 2. Scaffold

Vite 5 + React 18 + TypeScript strict + Tailwind 3, `react-router-dom` 6, `react-markdown` + `remark-gfm`, `@floating-ui/react`, `zod`, `js-yaml`; dev: `vitest`, `jsdom`, `@playwright/test`, `@axe-core/playwright`. Add the kind-specific libraries from §8. Repo layout per MI DESIGN-SYSTEM §7, plus `src/lib/storage/` (on-device workspace adapter), `src/lib/analysis/` (workbench), `tests/walkthroughs/` and `tests/safety/`. Wire `BASE_PATH` and the `404.html` fallback.

## 3. Content build: `scripts/build-content.ts` (`npm run build:content`)

1. Validate every pack file with zod schemas that mirror `docs/ACTION-PACK.md`. The same rules as `tools/validate_pack.py`, which must also pass: run it in CI.
2. Resolve every cross-reference: codes, groups, link endpoints, `suggest` codes, `refs` numbers, persona ids in scenarios, term and concept ids.
3. Emit `src/data/*.json` per module, plus `references.json` (with abstracts), `glossary.json`, `concepts.json` and `strings.json`.
4. Emit `public/provenance.json` (ACTION-SPEC §6.6) and `public/staleness.json` (SUSTAIN §4).
5. Run the safety lint over the pack strings (SAFETY H1) and fail on a hit outside `allowed_contexts`.
6. Be idempotent, and print a summary table.

## 4. App

Build in this order so each step is testable: shell + theme + header/footer → `/about` and `/methods` → `/references`, `/glossary`, `/concepts/:id` → `/evidence` → **the main surface for `workbench`** (ACTION-SPEC §3, plus §8 below) → the on-device workspace (ACTION-SPEC §4) → (no `/help`: general profile) → `/` last, when there is something to start.

## 5. Tests

- **Vitest:** pack schemas (a fixture with one error per rule fails with the right message), storage adapter (save, load, migrate, clear), every analysis against the **golden fixtures** in §8 (a drift is a failure; never widen a tolerance), export/import round-trip.
- **Safety suite (`tests/safety/`)**, one spec per invariant of `general` (SAFETY tables): the request recorder (G2, H2: a typed sentinel string never appears in any request), the no-telemetry check (G5), clear-my-data, the notice, and the three app lints (`safety.yaml → app_lints`).
- **Walkthrough suite (`tests/walkthroughs/`)**, one spec per `scenarios.yaml` entry: perform each `do`, assert each `expect`, and assert each `must_not`.
- **Playwright smoke:** every route renders its h1; dark mode persists; 375 px; keyboard-only paths through the main surface; the accessible view (workbench) supports create, edit and delete.
- **Lighthouse:** Accessibility 100 on `/` and the main surface; Performance ≥ 90 on `/`.

## 6. Ship — delivery: **local**

First: `git init`; `.gitignore`; exclude `notes/`, `source/` and the hub via `.git/info/exclude`; `npm run build` (base `/`) and `npm run preview`, then check the root, a deep link and the main surface. Keep `npm ci`, `npm run build` and `npm run preview -- --port 4201 --strictPort` working, and keep `<title>` on one line (the launcher `▶ Open Plant Perception Pathways.command` depends on them).

Then only the branch that matches the delivery mode:
- **local:** no remote, no `gh repo create`, no `deploy.yml`. The README's quick start is local and ends with a "Publishing this later" recipe. Report the commit SHA and the two local commands.
- ~~pages~~ (not this app): `gh repo create danieladamek/plant-perception-pathways --public --source . --push`; a `deploy.yml` that runs `npm ci → npm test → build:content → build (BASE_PATH=/plant-perception-pathways/) → 404.html → deploy-pages`. Re-run the safety suite against the live URL.
- ~~private~~ (not this app): `--private`, no Pages, no `deploy.yml`.

## 7. Report

Write `notes/Scrums/YYMMDD.md`: what landed, the provenance counts, every `TODO(author)` and build error, the safety-suite and walkthrough results, and a checked copy of ACTION-SPEC §8. Anything unchecked goes under **▶️ Next**. Set the K item to `inreview`.

## 8. App-specific notes

**Normative for the main surfaces:** `content-pack/app-requirements.md` (a delta on PPE's UI-01…UI-31, which apply as written, read with this app's stage kinds) and `content-pack/app-methods.md` (every join, count and filter rule, with golden numbers). Read both end to end before §4. Where §2–§4 above name routes or modules this app does not have (`/glossary`, `/concepts/:id`), skip them and say so in the report.

### 8.1 This app is a host of the shared core — build no UI of your own for core surfaces
- **Dependency:** `@actualizer/perception-core` 0.1.0, consumed by **local path** (Daniel, 2026-11-19): `"@actualizer/perception-core": "file:../perception-pathways-explorer/packages/perception-core"`. The tag `perception-core-v0.1.0` (`6f5f73d`) is local only; record in the README that a URL or registry install replaces this line later. Read the core's `README.md`, `THEME.md` and `CHANGELOG.md` first.
- **Use it as its README says:** `definePack(eager, lazy)` over this app's content-build JSON; `<Explorer pack theme storageNamespace="plant-perception-pathways" appTitle strings modules={[]} />`. Vite `build.target: 'es2022'`; Tailwind `content` includes the core's `src/**/*.{ts,tsx}`; colour names `ink`, `paper`, `night`; font families `display`, `body`, `mono`.
- **Modules:** none. The atlas module is **off**, and there is no vagus lens (app-requirements §2.2). The lens list is None and Shared hardware.
- **Stages come from the pack** (`manifest.stage_kinds`, core_schema 0.2). Hard-code none of them.
- **Molecule stage:** every molecule record carries `stage`. The core's loader defaults a missing stage to PPE's `'transducer'` (`lib/data/index.ts:45`, tracked as A5.3). The plant pack never relies on that default. Add a content-build check that fails if any molecule lacks `stage`.
- **Core defects:** if a core surface is wrong for plant data, don't patch it locally and don't edit the core. Work around it only if the pack allows it without a fork. Otherwise list it under ▶️ Next as a proposed core item, with the surface, the plant row and what you saw.
- **Parity:** the core harness (`packages/perception-core/harness`) must pass at the version you consume. Run it once and report the result. Take one parity screenshot per main surface (home, navigator with Focus on PD01, one molecule sheet, one structure) to guard future core upgrades.

### 8.2 Theme, type, logo — Greenhouse Explorer's (app-requirements §3)
- **Source of truth:** the greenhouse-explorer repo at `../greenhouse-explorer/`, **as of commit `32a18ad`** (its local `main`, which includes the K5.1 restyle). The hub's `c53d062` cannot be read in the local clone. Read files with `git -C ../greenhouse-explorer show 32a18ad:<path>`, and never edit that repo.
  - Tokens: `src/index.css` and `tailwind.config.js`, with the AA-corrected values muted `#5f5442`, accent `#2d6848`, amber `#924817`. The A5.2 harness theme (`packages/perception-core/harness/greenhouse.css` and its `tailwind.config.js`) already encodes these, so start from it.
  - Stage tokens: add the six `--stage-stimulus … --stage-response`, chosen from that palette. Each must pass AA against its node label in light and dark. Assert this in a test.
- **Type:** Fraunces, Source Sans 3, JetBrains Mono, all bundled with fontsource. Use the deferred-font pattern from greenhouse-explorer `src/lib/fonts.ts`.
- **Logo:** the committed files in greenhouse-explorer `public/brand/` at `32a18ad` (light and dark mark, illustration, favicons, OG image), copied byte for byte. A test compares their sha256 with the source.
- **Wordmark:** `ui-strings.yaml → brand` ("Plant", "Perception Pathways"), set as Greenhouse *Explorer* is.

### 8.3 Extension files (not in ACTION-PACK)
`manifest.extensions` lists them: `paths.yaml`, `hierarchy.yaml`, `hubs.yaml`, `legend.yaml`, `molecules.yaml`, `structures.yaml` (with the bundled files in `content-pack/structures/`, including `structures/small/`), `anatomy.yaml`, `structure-curation.yaml`, `small-molecules.yaml` and `context-note.md`. `interactions.yaml` is present and empty in pack 0.1.
- Give each file the zod schema the core's loader expects, mirroring `tools/validate_extension.py`.
- Run **both** validators in CI: `python3 tools/validate_pack.py content-pack && python3 tools/validate_extension.py content-pack`, 0 errors. Two warnings are expected: NFR5 is an unreviewed record; OT5 is not in PubChem.
- `context-note.md` is the About page's framing, "Is this perception? Two views". Render it on `/about` as markdown.
- Copy the structure files into `public/structures/` at content build. Verify each sha256 against `structures.yaml`; a mismatch is a build error.

### 8.4 Golden fixtures (app-methods; a drift is a failure)
- **Paths:** 67 curated (PT07 dropped and PZ08 About-page stay out).
  - Tiers: B1 33 · B2 17 · B3 17.
  - Rows with ⚑ in some field: 21.
  - Dual membership: PL02, PT05, PX05.
- **Evidence species:**
  - other species only: PS01 PS02 PZ02 PZ03 PZ07;
  - mixed: PSI01 PZ04;
  - every other row is Arabidopsis.
- **Molecules:** 120 (receptor 65, cascade 44, integration 9, response 1, notes 1).
- **Structures:** 116 bundled (50 PDB, 66 AlphaFold).
- **Hubs:** 13. PHYB 5, CRY1 4, PHOT1 3, PHOT2 3, and the rest 2.
- **Small molecules:** 41; 9 hidden by default; 1 not found.
- **Anatomy:** 51 stage values, 68 Plant Ontology terms.
- **References:** 152, all verified, 151 with abstracts.
- **Gaps:** PD01 has a null `signal_route` (w12).

Add a tiny synthetic plant pack under `tests/fixtures/` for the navigator derivation, with hand-written expected nodes and edges:
- 3 paths;
- one shared `integration` string;
- one null stage;
- one dual-membership row;
- one other-species row.

The core's `plant-min` fixture is a model; mark yours `fixture: true`.

### 8.5 Persona-specific checks
- `p-student` uses a screen reader. Run axe on every route. The viewer has a text alternative (the structure record), and every 3D control is a labelled button.
- All personas: the design targets are 1280 px and tablet (768 px). At 375 px every route renders read-only without horizontal scroll.
- Other-species evidence is visibly distinct everywhere a species shows (the 🌱 badge, app-requirements §2.6). A test asserts the badge on PS01 and its absence on an Arabidopsis row (PD01).
- Candidate senses (contested) form a distinct group with the badge "candidate sense — not established". They are never counted among established senses on Home (app-requirements §2.7).
- A non-Arabidopsis structure carries the "{organism} structure; the Arabidopsis protein may differ" chip. An unreviewed record carries "UniProt record not reviewed" (§2.5). Featured-structure `coverage` sits beside the experimental/predicted badge (§2.4).

### 8.6 Things that must not happen (each is a test)
- No centrality wording and no computed centrality (`app_lints.centrality`).
- No internal project terms in `dist/` (`app_lints.jargon`).
- No sentence in app copy that asserts plants are conscious, feel pain, hear, learn or think (`app_lints.contested-framing`). Quoted abstracts are exempt.
- No predicted model without its badge.
- No candidate (`verified: false`) reference shown as evidence.
- No atlas, no vagus lens, no greenhouse content, no grow log (scope: these come with A4.2).
- No molecule drawn as a node at a stage other than its own `stage`. `also_named_in` mentions are listed on the sheet only.
- No runtime fetch, including from Mol*.
- No local copy or fork of a core component.

### 8.7 Reference implementations (mine, don't copy data)
- `../perception-pathways-explorer/`: the core's first host. Its `src/main.tsx`, `scripts/build-content.ts`, theme wiring, safety suite and walkthrough harness are your closest pattern. PPE's own modules (vagus) are not yours.
- `../perception-pathways-explorer/packages/perception-core/harness`: the plant fixture under the Greenhouse theme, already reviewed on :4210.
- `../greenhouse-explorer/`: tokens, fonts, brand, chips (read-only, at `32a18ad`).

None of their data enters this app.
