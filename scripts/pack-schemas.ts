/**
 * Zod schemas mirroring docs/ACTION-PACK.md (tools/validate_pack.py 0.1.2) and this app's extension files
 * (tools/validate_extension.py, content-pack/app-methods.md). Shapes only; cross-file rules live in build-content.ts.
 * Pattern mined from Perception Pathways Explorer's scripts/pack-schemas.ts; the plant shapes differ: path fields come
 * from manifest.stage_kinds, there are no percepts, proposed routes or atlas, molecules carry `stage` and `mapping`,
 * identity comes from UniProt (no HGNC), anatomy is Plant Ontology.
 */
import { z } from 'zod';

const str = z.string();
const nstr = z.string().nullable();
const day = z.union([z.string(), z.date()]).transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)));

const ROLE = z.enum(['molecules', 'compare_string', 'anatomy', 'loop', 'loop_variable', 'loop_effector', 'loop_key'], {
  errorMap: () => ({ message: 'unknown stage role (molecules, compare_string, anatomy, loop, loop_variable, loop_effector, loop_key)' }),
});
const StageField = z.object({ id: str.min(1), label: str.min(1), roles: z.array(ROLE).optional() });
export const StageKind = z
  .object({
    id: str.min(1),
    label: str.min(1),
    short_label: str.min(1),
    colour: str.regex(/^--[\w-]+$/, 'colour must name a CSS variable (e.g. --stage-stimulus)'),
    shape: str.optional(),
    repeatable: z.boolean(),
    roles: z.array(ROLE).optional(),
    edge_in: StageField.optional(),
    with: z.array(StageField).optional(),
  })
  .strict();
const SpeciesRule = z.object({ label: str.min(1), match: str.min(1) });

export const Manifest = z
  .object({
    slug: str.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case'),
    title: str,
    short_title: str,
    kind: z.enum(['navigator', 'planner', 'workbench']),
    modules: z.array(z.enum(['situations', 'links', 'pathway', 'resources', 'planner'])),
    safety_profile: z.enum(['general', 'health', 'crisis-adjacent']),
    question: str,
    purpose: str.optional(),
    as_of: day,
    pack_version: str,
    authors: z.array(str).min(1),
    venue: str,
    evidence: z.object({ body: z.enum(['review', 'records']) }),
    extensions: z.array(str).default([]),
    delivery: z.enum(['local', 'pages', 'private']),
    storage: z.literal('device', { errorMap: () => ({ message: "storage must be 'device' in v0.1 (SAFETY H2)" }) }),
    github_account: str,
    port: z.number().int().optional(),
    builder: z.object({ name: str, version: str, date: day }),
    sources: z.object({ curation: z.object({ file: str, decisions: str, curated: day }) }).passthrough(),
    permissions: z.object({ text: str, figures: str }),
    concept_self_checks: z.boolean().optional(),
    design: z.record(str).optional(),
    core_schema: z.literal('0.2', { errorMap: () => ({ message: 'core_schema 0.2 expected (perception-core 0.1.x)' }) }),
    stage_kinds: z.array(StageKind).min(1, 'stage_kinds needs at least one stage'),
    evidence_species: z.object({ reference: SpeciesRule, model: SpeciesRule.extend({ icon: str.optional() }) }),
    reference_organism: z.object({ name: str, label: str }),
    anatomy_ontologies: z.object({ source: str, ontologies: z.array(z.object({ prefix: str, short: str, name: str })).min(1) }),
  })
  .strict();

export const Persona = z.object({
  id: str,
  label: str,
  acts_for: z.enum(['self', 'other', 'group']),
  situation: str.optional(),
  deciding: str.optional(),
  constraints: z
    .object({
      reading_level: z.enum(['grade-6', 'grade-9', 'grade-12', 'professional']),
      device: z.array(z.enum(['phone', 'tablet', 'laptop', 'projector'])).optional(),
      stress: z.enum(['low', 'moderate', 'high']).optional(),
      languages: z.array(str).optional(),
      accessibility: z.array(str).optional(),
      time: str.optional(),
    })
    .passthrough(),
  jobs: z.array(str).min(1, 'every persona needs at least one job'),
});
export const Audience = z.object({ personas: z.array(Persona).min(1, 'at least one persona'), constraints_global: z.any().optional() });

export const Scenario = z.object({
  id: str,
  persona: str,
  title: str,
  starts_with: str,
  steps: z.array(z.object({ do: str.min(1, 'do required'), expect: str.min(1, 'expect required') })).min(1, 'steps required'),
  must_not: z.array(str).min(1, 'must_not required'),
});
export const Scenarios = z.array(Scenario);

export const AppLint = z.object({ id: str, rule: str, phrases: z.array(str).min(1), allowed_phrases: z.array(str).optional(), scope: str });
export const Safety = z
  .object({
    profile: z.enum(['general', 'health', 'crisis-adjacent']),
    notice: str.min(1, 'notice required (SAFETY H5)'),
    blocked_phrases: z.array(str).default([]),
    allowed_phrases: z.array(str).optional(),
    allowed_contexts: z.array(z.object({ field: str })).optional(),
    app_lints: z.array(AppLint).default([]),
  })
  .strict();

export const UiStrings = z
  .object({
    brand: z.tuple([str, str]),
    home: z.object({ tagline: str, start: str, status_line: str }).passthrough(),
    gaps: z.object({ card: str, count: str }),
    badges: z.record(str),
    labels: z.record(str),
    maps: z.record(str),
  })
  .passthrough();
export const Todo = z.array(z.object({ id: str, what: str, where: str.optional(), owner: str.optional() }).strict());
export const Upkeep = z.object({
  classes: z.array(z.object({ id: str, what: str, recheck_days: z.number().int('integer recheck_days required'), how: str })).min(1, 'classes required'),
  harvests: z.array(z.any()).optional(),
  sweeps: z.array(z.any()).optional(),
});
export const Planner = z.object({
  holds: z.enum(['plan', 'map', 'both']),
  schema_version: z.number().int(),
  export: z.array(str),
  import: z.array(str),
  fields: z.any(),
  templates: z.array(z.any()).default([]),
});

export const Reference = z
  .object({
    n: z.number().int('entry without integer n'),
    key: str,
    citation: str,
    year: z.number().int(),
    tier: z.enum(['seminal', 'classic', 'current', 'background']),
    doi: nstr.optional(),
    url: nstr.optional(),
    pmid: z.union([str, z.number()]).nullable().optional(),
    isbn: z.union([str, z.number()]).nullable().optional(),
    verified: z.boolean(),
    verified_how: str.optional(),
    verified_via: str.optional(),
    cited_by_paths: z.array(str).default([]),
    abstract: nstr.optional(),
    abstract_source: nstr.optional(),
    abstract_note: str.optional(),
    harvested_on: day.nullable().optional(),
    summary: str.optional(),
    why_it_mattered: str.optional(),
  })
  .strict();
export const References = z.array(Reference);

/** fields every path row carries besides its stage fields (validate_extension.py FIELDS) */
export const PATH_META = [
  'path_id', 'perception_branch', 'sense_leaf', 'stimulus_origin', 'transducer_tier', 'hypothesis_group', 'row_status', 'provenance',
  'notes', 'evidence_species', 'key_citation', 'citation_verified',
] as const;
export const Paths = (stageFields: string[]) => z.object({ paths: z.array(pathSchema(stageFields)) });
/** the path schema is built from the manifest's stage_kinds (core_schema 0.2): no stage is hard-coded here */
export function pathSchema(stageFields: string[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of [...PATH_META, ...stageFields]) shape[f] = nstr;
  return z
    .object({
      ...shape,
      path_id: str.regex(/^P[A-Z]{1,3}\d{2}$/, 'path_id must look like PL01 / PCD01'),
      perception_branch: str,
      sense_leaf: str,
      transducer_tier: z.enum(['B1', 'B2', 'B3'], { errorMap: () => ({ message: 'bad tier' }) }),
      row_status: z.literal('curated', { errorMap: () => ({ message: 'only curated rows ship (app-methods §1.1)' }) }),
      also_in: z.array(str).default([]),
      provenance_words: z.array(str),
      contested_fields: z.array(str),
      refs: z.array(z.number().int()).min(1, 'no reference'),
    })
    .strict();
}

export type TreeNode = { name: string; children?: TreeNode[]; path_ids?: string[]; dual?: boolean };
export const TreeNodeS: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({ name: str, children: z.array(TreeNodeS).optional(), path_ids: z.array(str).optional(), dual: z.boolean().optional() }).strict(),
);
export const Hierarchy = z.object({ tree: TreeNodeS });

export const Hubs = z.object({
  caution: str.min(1, 'caution text missing (app-methods §5)'),
  hubs: z.array(z.object({ molecule: str, path_ids: z.array(str).min(2, 'a shared-hardware entry needs two or more paths') }).strict()),
});

export const Legend = z.object({ legend: z.array(z.object({ item: str, meaning: str }).strict()), dropped_internal_rows: z.array(str).optional() });

const PdbEntry = z
  .object({
    id: str,
    title: nstr.optional(),
    method: nstr.optional(),
    resolution_A: z.number().nullable().optional(),
    released: nstr.optional(),
    organism: nstr.optional(),
    matched_by: nstr.optional(),
    entities: z.array(z.object({ entity: str, description: nstr.optional(), chains: z.array(str).optional(), organisms: z.array(nstr).optional(), uniprot: z.array(str).optional() }).passthrough()).optional(),
    ligands: z.array(z.object({ id: str, name: nstr.optional() })).optional(),
    citation: z.any().optional(),
    source: str,
    retrieved_on: day,
    fragment: z.boolean().optional(),
  })
  .passthrough();
export const Molecule = z
  .object({
    id: str,
    kind: z.enum(['protein', 'complex-subunit', 'family', 'small-molecule']),
    // KICKOFF §8.1: the plant pack never relies on the core's PPE default ('transducer'); a missing stage is an error
    stage: str.min(1, 'stage required'),
    paths: z.array(str),
    as_written: str,
    mapping: str.regex(/curator mapping/, 'mapping must be labelled a curator mapping'),
    also_named_in: z.record(z.array(str)).optional(),
    seed_note: str.optional(),
    uniprot: z
      .object({
        accession: str,
        entry_name: str.optional(),
        protein_name: str.nullable().optional(),
        gene_names: z.array(str).default([]),
        ordered_locus_names: z.array(str).default([]),
        organism: str,
        taxon_id: z.number().int(),
        reviewed: z.boolean(),
        length: z.number().int(),
        function: z.array(z.object({ text: str, evidence: z.array(z.any()).optional() })).default([]),
        subcellular_location: z.array(z.object({ text: str }).passthrough()).default([]),
        source: str,
        retrieved_on: day,
        licence: str.optional(),
      })
      .passthrough(),
    pdb_entries: z.array(PdbEntry).default([]),
    pdb_found: z.number().nullable().optional(),
    alphafold: z.array(z.object({ entryId: str, uniprotAccession: str, uniprotStart: z.number().optional(), uniprotEnd: z.number().optional(), latestVersion: z.number(), source: str, retrieved_on: day }).passthrough()).default([]),
    featured: z.object({ id: str, source_db: z.enum(['PDB', 'AlphaFoldDB']), why: str, coverage: str.optional(), chain_length: z.number().nullable().optional(), uniprot_length: z.number().nullable().optional() }).strict().nullable(),
  })
  .strict();
export const Molecules = z.object({ molecules: z.array(Molecule) });

export const Structure = z
  .object({
    id: str,
    molecules: z.array(str).min(1),
    source_db: z.enum(['PDB', 'AlphaFoldDB']),
    featured: z.boolean(),
    kind: z.enum(['experimental', 'predicted']),
    organism: str,
    file: str.regex(/^structures\//),
    sha256: str.regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 hex digits'),
    reason: str,
    plddt_mean: z.number().optional(),
    version: z.number().optional(),
    file_url: str.optional(),
  })
  .strict();
export const Structures = z.object({ structures: z.array(Structure) });

export const Interaction = z
  .object({
    id: str,
    kind: z.enum(['ligand-binding', 'protein-complex', 'signalling-2d'], { errorMap: () => ({ message: 'bad kind' }) }),
    title: str,
    molecules: z.array(str),
    structure: str.optional(),
    paths: z.array(str),
    role: str,
    refs: z.array(z.number().int()),
    species: z.array(str).optional(),
    structure_record: z.any().optional(),
  })
  .passthrough();
export const Interactions = z.object({ interactions: z.array(Interaction).default([]) });

export const StructureCuration = z
  .object({
    plant_taxa: z.array(str).min(1),
    excluded_components: z.array(str),
    featured: z.record(z.object({ id: str, reason: str })).default({}),
    include_entries: z.record(z.any()).default({}),
    prefer_predicted: z.record(str).default({}),
    exclude_entries: z.record(z.record(str)).default({}),
  })
  .strict();

const SmForm = z.object({ cid: z.number().int(), title: str.nullable(), inchikey: str, conformer: z.enum(['3d', '2d-only', 'unknown']), file: str.nullable().optional(), sha256: str.nullable().optional(), source: str }).passthrough();
/** small-molecules.yaml (app-methods §8). Class is a curator label; cofactors and additives are hidden by default. */
export const SmallMolecule = z
  .object({
    id: str,
    pubchem: z.object({ CID: z.number().int(), MolecularFormula: str, MolecularWeight: z.union([str, z.number()]), SMILES: str, InChIKey: str, IUPACName: str.nullable().optional(), Title: str.nullable().optional(), source: str.min(1, 'PubChem source missing') }).passthrough(),
    retrieved_on: day,
    conformer: z.enum(['3d', '2d-only', 'unknown'], { errorMap: () => ({ message: "conformer must be '3d', '2d-only' or 'unknown'" }) }),
    file: str.nullable().optional(),
    sha256: str.nullable().optional(),
    forms: z.array(SmForm).min(1),
    classes: z.array(str.min(1)).min(1),
    sources: z.array(str),
    ccd: z.array(str).default([]),
    bound_in: z.array(z.object({ structure: str, partners: z.array(str) })).default([]),
    paths: z.array(str).default([]),
    interactions: z.array(str).default([]),
    hidden_by_default: z.boolean(),
  })
  .passthrough();
export const SmallMolecules = z.object({ about: str.optional(), molecules: z.array(SmallMolecule), not_found: z.array(z.object({ id: str, query: str, why: str }).passthrough()).default([]) }).strict();

export const AnatomyTerm = z
  .object({
    part: str.optional(),
    id: z.string().regex(/^PO:\d{7}$/, 'bad ontology id (PO:nnnnnnn)').nullable(),
    label: str.optional(),
    mapping: str.optional(),
    match: str.optional(),
    definition: str.nullable().optional(),
    synonyms: z.array(str).default([]),
    parents: z.array(z.object({ id: str, label: str }).passthrough()).default([]),
    source: str.optional(),
    retrieved_on: day.optional(),
  })
  .passthrough()
  .superRefine((t, ctx) => {
    if (t.id && (!t.label || !t.source || !t.retrieved_on)) ctx.addIssue({ code: 'custom', message: `term ${t.id}: label, source and retrieved_on required` });
    if (t.id && !/curator mapping/.test(t.mapping ?? '')) ctx.addIssue({ code: 'custom', message: `term ${t.id}: must be labelled a curator mapping` });
  });
export const Anatomy = z.object({ values: z.array(z.object({ stage: str, value: str, paths: z.array(str).default([]), terms: z.array(AnatomyTerm).default([]) }).passthrough()) }).strict();

export const Changes = z.array(
  z.object({ date: day, version: str, what: str, why: str.optional(), records: z.array(str).default([]), source: str.optional(), by: str.optional() }).strict(),
);
