---
type: app-requirements
project: actualizer
app: plant-perception-pathways
as_of: 2026-11-19
---

# Plant Perception Pathways — normative UI requirements

## 0. What Daniel asked for (2026-11-18)
- "I'd like to develop the sensory mapping out as it's own thing similar to the perception pathways explorer, (actually
  with identical functionality) before tying it to the other features of the site."
- "I would like it to use all the same design scheme as the greenhouse explorer as at some point we'll want to integrate
  it into that."
- "Use same logo as it will be part of that application eventually."
- Senses Arabidopsis lacks are included with their species clearly labelled; contested senses are labelled contested.

## 1. Functionality is PPE's, through the shared core
1.1 The app is a host of `@actualizer/perception-core` (A5.2), pinned to a tagged version (≥ 0.1.0; 0.1.1 once A5.3
lands). Every surface and behaviour of the core is required as PPE has it: navigator and canvas, Focus, layouts, stage
row and stage inspector, molecule sheets, Mol* viewer, shared hardware, evidence table, hierarchy, search, small-molecule
catalogue, My maps, notepad, full screen and info bar, header menus. **PPE's requirements UI-01 … UI-31 apply as
written**, read with this app's stage kinds; this document lists only what differs.
1.2 No feature is forked into this app. A change the plant app needs in a core surface is a core change (a backlog item
on the core), released as a new core version that PPE also passes.

## 2. Pack contract
2.1 The pack is `content-pack/` (pack 0.1, core_schema 0.2), normative in `app-methods.md`. Stage kinds, species rules,
reference organism and anatomy ontology come from `manifest.yaml`; the app hard-codes none of them.
2.2 Modules: the atlas module is **off** (no atlas). There is no vagus lens. Lenses whose data the pack does not have are
not offered (no proposed routes, no loops in pack 0.1); the lens list is None and Shared hardware.
2.3 Every molecule carries `stage`; a molecule's `also_named_in` mentions are listed on its sheet ("also named in PW03
(cascade)"), never drawn as nodes.
2.4 The featured structure's `coverage` is shown on the sheet next to the experimental/predicted badge.
2.5 Structures from an organism other than Arabidopsis carry the "{organism} structure; the Arabidopsis protein may
differ" chip; unreviewed UniProt records carry "UniProt record not reviewed".
2.6 Rows matching `evidence_species.model` carry the 🌱 other-species badge in every list, card and export.
2.7 The "Candidate senses (contested)" branch is drawn as a distinct group (as PPE's branch C) with the badge
"candidate sense — not established"; its rows never appear in counts of established senses on the home page.

## 3. Design: Greenhouse Explorer's scheme
3.1 **Theme.** The host theme is Greenhouse Explorer's, as the A5.2 harness proved: `src/index.css` and
`tailwind.config.js` from danieladamek/greenhouse-explorer at c53d062, with the AA-corrected values (muted `#5f5442`,
accent `#2d6848`, amber `#924817`) and its light and dark modes. The core's class and token contract (THEME.md) is met by
that theme plus the six stage tokens `--stage-stimulus … --stage-response`, chosen from the Greenhouse palette, each
passing AA against its node label in light and dark.
3.2 **Type.** Fraunces (display), Source Sans 3 (body), JetBrains Mono (identifiers, tier badges), bundled with
fontsource, never fetched at runtime.
3.3 **Logo.** The Greenhouse Explorer mark and illustration, reused as committed in greenhouse-explorer `public/brand/`
(light and dark mark, illustration, favicons, OG image): copied byte for byte, never recoloured or recropped.
3.4 **Wordmark.** "Plant *Perception Pathways*", set as Greenhouse *Explorer* is (`ui-strings.yaml` `brand`).
3.5 **Wording.** The remaining PPE intro lines that say "transducer" (Home, Molecules, Hierarchy, Percepts; A5.2 note)
come from this app's strings: "Receptor and transducer molecules". There is no Percepts page.

## 4. Safety and scope
General profile (`safety.yaml`): the notice on Home and About; lints for internal jargon, centrality wording and
contested framing (no sentence may assert that plants are conscious, feel pain, hear or learn; quoted abstracts are
exempt, UI-31). Greenhouse content stays out until A4.2.

## 5. Acceptance
The walkthroughs in `scenarios.yaml` (w1–w12), clicked by Daniel; the goldens in `app-methods.md` as unit tests; PPE's
parity suite stays green whenever the core changes.
