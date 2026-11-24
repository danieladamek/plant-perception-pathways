---
type: app-methods
project: actualizer
app: plant-perception-pathways
pack_version: "0.1"
core_schema: "0.2"
as_of: 2026-11-19
---

# Plant Perception Pathways — normative methods

These rules are normative for the build: Claude Code implements them, and the walkthroughs and tests check them. They
follow the Perception Pathways Explorer's methods (PPE `app-methods.md`) section by section; where a rule differs for
plants it says so. Scope (Daniel, 2026-11-18): general plant biology, built the PPE way; greenhouse content stays out of
this app until the Greenhouse Explorer tie-in (A4.2).

## 1. Where the pathways come from

1.1 **Curation.** Cowork drafted one row per sense from verified abstracts (U1 sweeps 1–9) and Daniel curated every row
(`source/curation/decisions.yaml`, 2026-11-18/19). Only rows with `row_status: curated` ship; a dropped row (PT07) and the
About-page framing entry (PZ08) stay in `source/` for the record. The rows are exported in PPE's Sheet shape
(`source/data/`, `tools/export_handoff.py`) and assembled by `tools/assemble_pack.py`, which copies fields one for one
(`null` stays `null`) and only **adds** `provenance_words`, `contested_fields` (fields whose text holds ⚑) and `refs`.

1.2 **References.** A reference is `verified: true` only when the OpenAlex record's title for its DOI, normalised (lower
case; letters, digits and spaces only), matches the expected title with a difflib ratio of at least 0.85; the ratio is
stored in `verified_how`. Plant extension (approved by Daniel, 2026-11-18): when OpenAlex's own title is defective, the
Europe PMC title for the same DOI is compared at the same threshold and `verified_via: europepmc` is recorded (one
reference). Abstracts are verbatim and attached only to verified records; OpenAlex text that is an editor's summary, a
Significance statement or a truncated abstract is replaced by the Europe PMC abstract (`harvest_openalex.py` v0.2.4).
A path's references come from its `key_citation` list, never from reading text. Tier: reviews and position papers are
`background`, primary research `current`; seminal/classic are left to the curator.

1.3 **Provenance.** `A` = the stage text quotes or closely tracks a verified abstract; `K` = curator knowledge, not
verified (one note: PS01 "Arabidopsis does not nodulate"). Verification is at abstract level, not full text.

## 2. The navigator graph

2.1 **Stages** (pack data, core_schema 0.2: `manifest.stage_kinds`): `stimulus`, `receptor` (label "Receptor /
transducer"; the molecule stage), `cascade`, `signal_route`, `integration`, `response` (with `response_role`). Plants have
no fibres, ganglia or central relays; long-distance travel is the signal route, and distributed integration
(hormone crosstalk, the clock) is its own stage. There are no loops in this pack.

2.2 **Node identity.** As PPE: a stage node is the pair (stage, value), value trimmed, whitespace collapsed, compared
case-insensitively; values are never merged by judgment. `signal_route` and `integration` have the `compare_string`
role ("Same ‹stage›" between paths).

2.3 **Receptor molecules.** The receptor stage is drawn as molecule nodes from `molecules.yaml`: a molecule joins a path
when the path id is in its `paths` list and its `stage` is `receptor`. Every molecule record carries `stage` explicitly
(the core's loader default is PPE's stage name; the plant pack never relies on it). A molecule named at another stage
of some path keeps those mentions in `also_named_in` (shown on its sheet, never drawn as a node). A path whose receptor
text maps to no molecule keeps one text node with its value.

2.4 **Edges and gaps.** One edge per consecutive pair of non-null stages; a null stage is a dashed gap card, and the edge
across it is dashed. Gap count = null fields among `stimulus, receptor, cascade, signal_route, integration, response,
response_role`. A gap means *no verified source yet*, never *nothing there*.

2.5 **Dual membership.** A row with `also_in` is listed under a second branch in the tree (leaf `dual: true`) and keeps
one node set: PL02 (Temperature + Light), PT05 (Osmotic and salt + Mechanical), PX05 (Osmotic and salt + Mechanical).

## 3. Evidence species

3.1 Arabidopsis thaliana is the reference organism (`manifest.reference_organism`); `evidence_species` is matched by
`manifest.evidence_species` (reference: Arabidopsis thaliana / A. thaliana; other species: "NOT Arabidopsis", Lotus,
Medicago, Oenothera, Pisum, Brassica, Cakile). Rows from other species are drawn distinct (🌱), as PPE draws
model-organism rows (Daniel, 2026-11-18: senses Arabidopsis lacks are included, clearly labelled).
**Golden:** other species only — PS01 PS02 PZ02 PZ03 PZ07; mixed — PSI01 PZ04; every other row Arabidopsis.

## 4. Molecules and structures

4.1 **Identity and function text** come only from the structure harvest (`harvest_structures.py --taxon 3702`; Medicago
3880 and Lotus 34305 for PS01): the reviewed UniProt record (accession, protein name, gene names, AGI locus, organism,
FUNCTION and SUBCELLULAR LOCATION verbatim), RCSB PDB, AlphaFold DB and PubChem, each with source URL and date. No HGNC.
One record is unreviewed (Lotus NFR5), and its sheet says so.

4.2 **Curator mapping.** `source/molecule-mapping.yaml` maps names in the stage text to harvested molecules (whole-word
match of the symbol or a listed alias, e.g. "phyB" → PHYB, "OST1" → SRK2E, "FERONIA" → FER). Every record carries
`mapping: "curator mapping: …"`. The LZY family mapping (PG01) is labelled as not yet matched to UniProt numbering.

4.3 **Listed structures.** Every PDB entry the harvest found for the molecule's accession, or for its gene name in a
plant taxon (`structure-curation.yaml` `plant_taxa`), newest first. Gene-name matches whose entity carries another
UniProt accession are namesakes and are dropped (e.g. an E3-ligase ZZ domain for LPR1).

4.4 **Featured structure**, unless `structure-curation.yaml` names another with a reason: (0) skip entries in which the
molecule appears only as a peptide or fusion (entity description contains "peptide" or a comma) or whose title names a
motif, peptide, degron or an engineered protein (miniSOG, iLOV); (1) Arabidopsis thaliana, then Medicago, then Lotus,
then any organism; (2) best resolution; (3) newest. Without a whole-protein PDB entry, the AlphaFold DB model is featured
with the predicted badge; `prefer_predicted` features it on purpose for largely disordered proteins (RIN4, JAZ1). The
sheet shows the featured choice, its reason, and its **coverage** ("whole protein" at ≥ 90% of the UniProt length,
otherwise "domain structure (n of m residues)").
**Golden:** 120 molecules (receptor 65, cascade 44, integration 9, response 1, notes 1) · 116 bundled structures
(50 PDB, 66 AlphaFold) · UVR8 featured 4D9S (curator override) · PHOT1 2Z6C, domain structure.

4.5 **Bundled files.** Featured structures only (BinaryCIF from RCSB, AlphaFold DB files), each with its sha256 in
`structures.yaml`; the build fails on a mismatch. Other entries link out. Interactions: none in pack 0.1.

## 5. Shared hardware

Molecules on the receptor stage of more than one path (`hubs.yaml`), as given, with the caution that counts are not
centrality. **Golden:** 13 — PHYB 5, CRY1 4, PHOT1 3, PHOT2 3, and BCA1, BCA4, UVR8, NRT1.1, BAK1, FLS2, FER, MSL10,
CRY2 with 2 each.

## 6. Evidence table

Columns as PPE with the plant stages. **Golden:** tiers B1 33 · B2 17 · B3 17; rows carrying ⚑ in some field: 21.

## 7. Candidate senses (contested)

The branch "Candidate senses (contested)" (as PPE's branch C) holds PZ01–PZ07. Each row shows its claim and, where one
exists, the counter-evidence in `hypothesis_group` (PZ06: the cryptochrome claim of Ahmad et al. against Harris et al.'s
failed replication; PZ07: Gagliano et al. 2016 against Markel 2020). These rows are never presented as established pathways. The consciousness/intelligence question is framing on
the About page (`context-note.md`), with both positions cited, and the app answers neither.

## 8. Small molecules

As PPE §10, with plant path ids. (a) Every non-polymer component of a bundled structure except the excluded list;
(b) every compound the curated rows name, mapped to a PubChem name (`source/small-molecules-seed.yaml`: e.g. "auxin" →
indole-3-acetic acid, "gibberellin" → gibberellic acid, JA-Ile as two stereo forms on one sheet). The bound phytochrome
chromophore has no PubChem record for its InChIKey and is mapped to free phytochromobilin. Class is a curator label;
**chromophores stay visible** (in photoreceptors the chromophore is the sensor); additives, cofactors and stray ions are
hidden by default. **Golden:** 41 small molecules; 9 hidden by default; 1 not found (a FERONIA inhibitor).

## 9. Anatomy

Anatomical names in the cascade, signal-route and response text are matched against a curator phrase list
(`source/anatomy-seed.yaml`) and mapped to the **Plant Ontology** through EBI OLS4 (`harvest_uberon.py`, PO). A pick is
kept only if the term's label or an English synonym matches the name (`match: exact (label|exact|broad)`), or one
contains the other's words (`trivially equivalent`); the level is recorded. "Xylem contact cell" and "branching" have no
term. Label, definition, synonyms and parents are verbatim from OLS; every term is labelled "curator mapping from
'‹name›'". **Golden:** 51 stage values, 68 terms.

## 10. Search

As PPE §9, over sense names, stage values, notes, molecule symbols, protein names, gene names, AGI loci, UniProt
accessions, PDB ids and small-molecule names.

## 11. Glossary (pack 0.2)

11.1 `glossary.yaml` is built by `tools/build_glossary.py` from `source/glossary/`, never by hand. Each term has one **basis**:
- `app convention`: the app's own notation (stages, tiers, flags), written from this file and `legend.yaml`. Shown unmarked.
- `ontology, verbatim`: the definition is quoted from a Gene Ontology, ChEBI or Plant Ontology record, or from an NCIT record carried over from PPE. It is shown with its id, label, source link and retrieval date (UI-31). A term whose record label differs from the term carries "curator mapping from '‹term›'", e.g. Self-incompatibility → GO:0048544 *recognition of pollen*.

11.2 Term popovers, "Used in" and the glossary page work as in PPE (UI-32), reading this pack's stage kinds. Variants are whole-word matches. Short or ambiguous ones (NO, SA, JA, GA) are left out, and the build drops any variant that collides with another term.

11.3 **Golden:** 102 terms. 21 are app conventions (notation). 11 are methods: 7 ontology verbatim, 4 app conventions. 70 are science, ontology verbatim: 45 GO and ChEBI, 25 Plant Ontology. Four picks have no definition in their ChEBI record and are left out: ethylene, jasmonic acid, gibberellin and brassinosteroid. Every concept's `terms` resolve.

## 12. Concept primers (pack 0.2)

12.1 There are four 101s in `concepts/`: *How a path is curated* and *Reading a molecular structure* have no prerequisites; *From stimulus to response in a plant* follows the first, and *Experimental and predicted structures* follows the second.
- Paragraphs marked `<!-- framing -->` restate this app's own rules and data.
- Every other paragraph cites verified references [n], at abstract level.

12.2 The contextual links (UI-33) are placed by the pack's concepts: `stage_row` → how-a-path-is-curated, `hierarchy` → how-a-path-is-curated, `viewer` → reading-a-structure, `computed_badge` → experimental-vs-predicted.
