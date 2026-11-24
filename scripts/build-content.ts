/**
 * build-content.ts — validate the content pack, resolve every cross-reference, run the safety lints, and emit
 * src/data/*.json (the files @actualizer/perception-core reads), public/provenance.json, public/staleness.json,
 * public/freshness.json, public/changes.json and public/structures/* (sha256-checked copies of the bundled coordinate files).
 *
 * Fails loudly (KICKOFF §1, §3): every problem is written to content-pack/BUILD-ERRORS.md and src/data/build-errors.json
 * (surfaced on #/methods); the rest is built. A pack string that trips a safety lint is withheld (rendered as an amber
 * TODO(author) marker, listed on Methods) and recorded as an error; the build exits non-zero only if a hit would still
 * render. Never "fixes" the pack. Idempotent: files are rewritten only when their content changes.
 *
 *   npm run build:content     (or: tsx scripts/build-content.ts [--pack content-pack] [--out src/data] [--check])
 *
 * Pattern mined from Perception Pathways Explorer's scripts/build-content.ts (no data copied).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import yaml from 'js-yaml';
import type { ZodTypeAny } from 'zod';
import { PACK_SCHEMA } from './yaml-schema';
import * as S from './pack-schemas';
import { lintHits, type Lint } from './lint';
import { glossaryUsedIn, type GlossEntry } from '@actualizer/perception-core/glossary-match';
import { nextOf, orderConcepts, parseConceptBody, type Concept } from '@actualizer/perception-core/concepts-build';
// not in the core's exports map; PPE's build imports it from the package source the same way
import { collectFreshness, type UpkeepClass } from '../node_modules/@actualizer/perception-core/src/lib/freshness';

const argv = process.argv.slice(2);
const argOf = (k: string) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PACK = path.resolve(ROOT, argOf('--pack') ?? 'content-pack');
const OUT = path.resolve(ROOT, argOf('--out') ?? 'src/data');
const PUB = path.resolve(ROOT, argOf('--public') ?? 'public');
const DRY = argv.includes('--check');
const TODAY = argOf('--as-of') ?? process.env.PPP_AS_OF ?? new Date().toISOString().slice(0, 10);

export type Problem = { level: 'error' | 'warning'; where: string; message: string };
const problems: Problem[] = [];
const E = (where: string, message: string) => problems.push({ level: 'error', where, message });
const W = (where: string, message: string) => problems.push({ level: 'warning', where, message });

const has = (f: string) => fs.existsSync(path.join(PACK, f));
function loadYaml(f: string, required = true): any {
  if (!has(f)) {
    if (required) E(f, 'missing');
    return undefined;
  }
  try {
    return yaml.load(fs.readFileSync(path.join(PACK, f), 'utf8'), { schema: PACK_SCHEMA });
  } catch (e: any) {
    E(f, `YAML error — ${e.message}`);
    return undefined;
  }
}
function parse<T extends ZodTypeAny>(f: string, schema: T, data: any): ReturnType<T['parse']> | undefined {
  if (data === undefined) return undefined;
  const r = schema.safeParse(data);
  if (!r.success) {
    for (const iss of r.error.issues.slice(0, 40)) E(`${f}${iss.path.length ? '/' + iss.path.join('.') : ''}`, iss.message);
    if (r.error.issues.length > 40) E(f, `${r.error.issues.length - 40} more schema issues`);
    return undefined;
  }
  return r.data;
}
const CITE = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
export function cites(text: string | null | undefined): Set<number> {
  const out = new Set<number>();
  for (const m of String(text ?? '').matchAll(CITE))
    for (const part of m[1].split(/\s*,\s*/)) {
      const rng = part.split(/\s*[-–]\s*/);
      if (rng.length === 2) for (let i = +rng[0]; i <= +rng[1]; i++) out.add(i);
      else out.add(+part);
    }
  return out;
}
const day = (v: unknown) => (v ? String(v).slice(0, 10) : null);
const ageDays = (d: string | null) => (d ? Math.round((Date.parse(TODAY) - Date.parse(d)) / 864e5) : null);
const sha = (f: string) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const count = <T,>(xs: T[], k: (x: T) => string) => xs.reduce<Record<string, number>>((a, x) => ((a[k(x)] = (a[k(x)] ?? 0) + 1), a), {});

// ───────────────────────── load + schema
const manifest = parse('manifest.yaml', S.Manifest, loadYaml('manifest.yaml'));
const audience = parse('audience.yaml', S.Audience, loadYaml('audience.yaml'));
const scenarios = parse('scenarios.yaml', S.Scenarios, loadYaml('scenarios.yaml'));
const safety = parse('safety.yaml', S.Safety, loadYaml('safety.yaml'));
const uiStrings = parse('ui-strings.yaml', S.UiStrings, loadYaml('ui-strings.yaml'));
const todo = parse('todo.yaml', S.Todo, loadYaml('todo.yaml', false) ?? []) ?? [];
const upkeep = parse('upkeep.yaml', S.Upkeep, loadYaml('upkeep.yaml'));
const scope = loadYaml('scope.yaml', false) ?? null;
const planner = parse('planner.yaml', S.Planner, loadYaml('planner.yaml'));
const references = parse('references.yaml', S.References, loadYaml('references.yaml')) ?? [];
const changes = parse('changes.yaml', S.Changes, loadYaml('changes.yaml', false) ?? []) ?? [];
const STAGE_FIELDS = manifest ? manifest.stage_kinds.flatMap((k) => [...(k.edge_in ? [k.edge_in.id] : []), k.id, ...(k.with ?? []).map((w) => w.id)]) : [];
const pathsF = parse('paths.yaml', S.Paths(STAGE_FIELDS), loadYaml('paths.yaml'));
const hierarchy = parse('hierarchy.yaml', S.Hierarchy, loadYaml('hierarchy.yaml'));
const hubsF = parse('hubs.yaml', S.Hubs, loadYaml('hubs.yaml'));
const legendF = parse('legend.yaml', S.Legend, loadYaml('legend.yaml'));
const moleculesF = parse('molecules.yaml', S.Molecules, loadYaml('molecules.yaml'));
const structuresF = parse('structures.yaml', S.Structures, loadYaml('structures.yaml'));
const interactionsF = parse('interactions.yaml', S.Interactions, loadYaml('interactions.yaml') ?? { interactions: [] });
const curation = parse('structure-curation.yaml', S.StructureCuration, loadYaml('structure-curation.yaml'));
const smallF = parse('small-molecules.yaml', S.SmallMolecules, loadYaml('small-molecules.yaml'));
const anatomyF = parse('anatomy.yaml', S.Anatomy, loadYaml('anatomy.yaml'));
const contextNoteRaw = has('context-note.md') ? fs.readFileSync(path.join(PACK, 'context-note.md'), 'utf8') : (E('context-note.md', 'missing'), '');
for (const f of ['app-requirements.md', 'app-methods.md']) if (!has(f)) E(f, 'a workbench needs app-requirements.md and app-methods.md');
const glossaryRaw = loadYaml('glossary.yaml', false);

const paths = pathsF?.paths ?? [];
const molecules = moleculesF?.molecules ?? [];
const structures = structuresF?.structures ?? [];
const interactions = interactionsF?.interactions ?? [];
const small = smallF?.molecules ?? [];

// ───────────────────────── manifest rules (validate_pack.py, validate_extension.py)
const MODULES = ['situations', 'links', 'pathway', 'resources', 'planner'];
const kinds = manifest?.stage_kinds ?? [];
const roleOf = (r: string) => kinds.filter((k) => (k.roles ?? []).includes(r as any)).map((k) => k.id);
const MOL_STAGE = roleOf('molecules');
const ANAT_STAGES = new Set(roleOf('anatomy'));
if (manifest) {
  if (!/peer/i.test(manifest.venue)) W('manifest', 'venue should make the not-peer-reviewed status unmissable');
  for (const mod of MODULES) {
    if (manifest.modules.includes(mod as any) && !has(`${mod}.yaml`)) E(`${mod}.yaml`, 'listed in manifest.modules but missing');
    if (has(`${mod}.yaml`) && !manifest.modules.includes(mod as any)) E(`${mod}.yaml`, 'present but not listed in manifest.modules');
  }
  for (const f of manifest.extensions) if (!has(f)) E('manifest.extensions', `${f} missing`);
  const ids = STAGE_FIELDS;
  for (const id of ids.filter((x, i) => ids.indexOf(x) !== i)) E('manifest.stage_kinds', `${id} listed twice`);
  if (MOL_STAGE.length !== 1) E('manifest.stage_kinds', `exactly one stage with role molecules expected, found ${MOL_STAGE.join(', ') || 'none'}`);
  // compare_string may sit on several stages (app-methods §2.2: signal_route and integration)
  for (const r of ['loop_variable', 'loop_effector', 'loop_key']) if (roleOf(r).length > 1) E('manifest.stage_kinds', `role ${r} is on more than one stage`);
  try {
    new RegExp(manifest.evidence_species.reference.match);
    new RegExp(manifest.evidence_species.model.match);
  } catch (e: any) {
    E('manifest.evidence_species', `match is not a valid pattern — ${e.message}`);
  }
  if (manifest.safety_profile !== safety?.profile) E('safety.yaml', `profile ${safety?.profile} differs from manifest ${manifest.safety_profile}`);
  if (manifest.modules.length !== 1 || manifest.modules[0] !== 'planner') W('manifest.modules', 'this app expects the planner module only (My maps)');
}

// ───────────────────────── references
const REF = new Map<number, (typeof references)[number]>();
for (const r of references) {
  if (REF.has(r.n)) E(`references/${r.n}`, 'duplicate n');
  REF.set(r.n, r);
  if (!(r.doi || r.url || r.isbn)) E(`references/${r.n}`, 'doi, url or isbn required');
  if (r.verified && (r.tier === 'seminal' || r.tier === 'classic') && !r.summary) E(`references/${r.n}`, `${r.tier} needs a summary`);
  if (r.verified && r.doi && r.abstract == null && !r.abstract_note) W(`references/${r.n}`, 'verified DOI with no abstract and no abstract_note');
  if (r.abstract && !r.harvested_on) E(`references/${r.n}`, 'abstract without harvested_on (abstracts are harvested, never typed)');
  if (r.abstract && !r.verified) E(`references/${r.n}`, 'abstract attached to an unverified record (app-methods §1.2)');
}
const isVerified = (n: number) => REF.get(n)?.verified === true;

// ───────────────────────── personas + scenarios
const personaIds = new Set((audience?.personas ?? []).map((p) => p.id));
const covered = new Set<string>();
for (const w of scenarios ?? []) {
  if (!personaIds.has(w.persona)) E(`scenarios/${w.id}`, `persona ${w.persona} not found`);
  covered.add(w.persona);
}
for (const p of personaIds) if (!covered.has(p)) E('scenarios', `no walkthrough for persona ${p}`);

// ───────────────────────── paths, tree, hubs
const PIDS = new Set(paths.map((p) => p.path_id));
const pathById = new Map(paths.map((p) => [p.path_id, p]));
const seenP = new Set<string>();
for (const p of paths) {
  const w = `paths/${p.path_id}`;
  if (seenP.has(p.path_id)) E(w, 'duplicate path_id');
  seenP.add(p.path_id);
  for (const n of p.refs) {
    if (!REF.has(n)) E(w, `ref ${n} not found`);
    else if (!isVerified(n)) E(w, `ref ${n} is not verified (it backs nothing; ACTION-SPEC §6.4)`);
  }
  for (const f of p.contested_fields) if (![...S.PATH_META, ...STAGE_FIELDS].includes(f)) E(w, `contested field ${f} is not a path field`);
  for (const f of [...S.PATH_META, ...STAGE_FIELDS]) {
    const v = (p as any)[f];
    if (typeof v === 'string' && v.includes('⚑') && !p.contested_fields.includes(f)) W(w, `${f} contains ⚑ but is not in contested_fields`);
  }
  if (p.provenance === 'A' && !p.refs.every((n) => REF.get(n)?.abstract)) W(w, 'provenance A but a cited reference has no abstract');
}
const treeIds = new Set<string>();
const dualIds = new Set<string>();
function walkTree(n: S.TreeNode, where: string) {
  for (const id of n.path_ids ?? []) {
    if (!PIDS.has(id)) E(`hierarchy/${where}`, `path ${id} not found`);
    treeIds.add(id);
    if (n.dual) dualIds.add(id);
  }
  for (const c of n.children ?? []) walkTree(c, `${where}/${c.name}`);
}
if (hierarchy) walkTree(hierarchy.tree, hierarchy.tree.name);
for (const id of PIDS) if (!treeIds.has(id)) E('hierarchy', `${id} not in the tree`);
for (const p of paths) {
  if (p.also_in.length && !dualIds.has(p.path_id)) E(`hierarchy`, `${p.path_id} has also_in ${p.also_in.join(', ')} but no dual leaf`);
  if (!p.also_in.length && dualIds.has(p.path_id)) E(`hierarchy`, `${p.path_id} has a dual leaf but no also_in`);
}

const MIDS = new Set(molecules.map((m) => m.id));
const hubsOut = (hubsF?.hubs ?? []).map((h) => {
  if (!MIDS.has(h.molecule)) E(`hubs/${h.molecule}`, 'not a molecule');
  for (const i of h.path_ids) if (!PIDS.has(i)) E(`hubs/${h.molecule}`, `${i} not found`);
  const m = molecules.find((x) => x.id === h.molecule);
  if (m && MOL_STAGE[0] && m.stage !== MOL_STAGE[0]) E(`hubs/${h.molecule}`, `shared hardware is on the ${MOL_STAGE[0]} stage; this molecule's stage is ${m.stage}`);
  if (m) for (const i of h.path_ids) if (!m.paths.includes(i)) E(`hubs/${h.molecule}`, `${i} is not in the molecule's paths`);
  // perception-core 0.3.0 derives n_paths and branches_spanned from path_ids (lib/data/hubs.ts): the pack's record as is
  return h;
});

// ───────────────────────── molecules, structures (sha256), interactions
const STAGE_IDS = new Set(kinds.map((k) => k.id));
for (const m of molecules) {
  const w = `molecules/${m.id}`;
  if (!STAGE_IDS.has(m.stage) && m.stage !== 'notes') E(w, `stage ${m.stage} is not a stage kind`);
  for (const i of m.paths) if (!PIDS.has(i)) E(w, `path ${i} not found`);
  for (const [i, sts] of Object.entries(m.also_named_in ?? {})) {
    if (!PIDS.has(i)) E(w, `also_named_in: path ${i} not found`);
    for (const st of sts) if (!STAGE_IDS.has(st)) E(w, `also_named_in: ${st} is not a stage kind`);
  }
  if (!m.uniprot.reviewed) W(w, `UniProt record is unreviewed (${m.uniprot.organism})`);
}
const SIDS = new Set<string>();
const copyPlan: { src: string; dest: string; id: string }[] = [];
for (const s of structures) {
  const w = `structures/${s.id}`;
  SIDS.add(s.id);
  for (const mm of s.molecules) if (!MIDS.has(mm)) E(w, `molecule ${mm} not found`);
  const f = path.join(PACK, s.file);
  if (!fs.existsSync(f)) E(w, `file ${s.file} not bundled`);
  else if (sha(f) !== s.sha256) E(w, `sha256 mismatch — file not copied (expected ${s.sha256}, got ${sha(f)})`);
  else copyPlan.push({ src: f, dest: path.join(PUB, s.file), id: s.id });
  if (s.source_db === 'AlphaFoldDB' && s.kind !== 'predicted') E(w, 'AlphaFold model must be kind predicted');
  if (s.source_db === 'PDB' && s.kind !== 'experimental') E(w, 'a PDB entry must be kind experimental');
}
for (const m of molecules) {
  if (m.featured && !SIDS.has(m.featured.id)) E(`molecules/${m.id}`, `featured ${m.featured.id} not bundled`);
  if (m.featured?.source_db === 'PDB' && !m.pdb_entries.some((e) => e.id === m.featured!.id)) W(`molecules/${m.id}`, `featured ${m.featured.id} not in its pdb_entries`);
}
for (const x of interactions) {
  if (!cites(x.role).size) E(`interactions/${x.id}`, 'role statement is not cited');
  for (const n of new Set([...cites(x.role), ...x.refs])) if (!isVerified(n)) E(`interactions/${x.id}`, `ref ${n} is not a verified reference`);
}
for (const sym of Object.keys(curation?.featured ?? {})) if (!MIDS.has(sym)) E(`structure-curation/featured/${sym}`, 'molecule not found');
for (const sym of Object.keys(curation?.prefer_predicted ?? {})) if (!MIDS.has(sym)) E(`structure-curation/prefer_predicted/${sym}`, 'molecule not found');

// ───────────────────────── small molecules (app-methods §8): 3D conformers are bundled for the viewer
const SMIDS = new Set<string>();
for (const g of small) {
  const w = `small-molecules/${g.id}`;
  if (SMIDS.has(g.id)) E(w, 'duplicate id');
  SMIDS.add(g.id);
  if (g.forms[0].file !== g.file) E(w, 'the sheet must open on its first form (file differs from forms[0].file)');
  for (const f of g.forms) {
    if (!f.file) continue;
    const src = path.join(PACK, f.file);
    if (!fs.existsSync(src)) E(w, `file ${f.file} not bundled`);
    else if (sha(src) !== f.sha256) E(w, `sha256 mismatch for ${f.file} — file not copied`);
    else copyPlan.push({ src, dest: path.join(PUB, f.file), id: `${g.id}/${f.cid}` });
  }
  for (const b of g.bound_in) {
    if (!SIDS.has(b.structure)) E(w, `bound in ${b.structure}, which is not a bundled structure`);
    for (const p of b.partners) if (!MIDS.has(p)) E(w, `partner ${p} in ${b.structure} is not a molecule record`);
  }
  for (const i of g.paths) if (!PIDS.has(i)) E(w, `path ${i} not found`);
  const hide = g.classes.some((c) => c === 'cofactor' || c === 'additive');
  if (hide !== g.hidden_by_default) W(w, `hidden_by_default is ${g.hidden_by_default} but its class is ${g.classes.join(', ')} (app-methods §8)`);
  if (g.classes.includes('chromophore') && g.hidden_by_default) E(w, 'a chromophore is hidden by default (app-methods §8: chromophores stay visible)');
}
for (const n of smallF?.not_found ?? []) W(`small-molecules/not_found/${n.id}`, `not found in PubChem; not in the catalogue`);

// ───────────────────────── anatomy (app-methods §9)
const stageValues = new Set(paths.flatMap((p) => [...ANAT_STAGES].filter((st) => (p as any)[st]).map((st) => `${st}\u0000${(p as any)[st]}`)));
for (const v of anatomyF?.values ?? []) {
  if (!ANAT_STAGES.has(v.stage)) E(`anatomy/${v.stage}`, 'stage has no anatomy role');
  if (!stageValues.has(`${v.stage}\u0000${v.value}`)) E(`anatomy/${v.stage}/${v.value.slice(0, 40)}`, 'not a curated stage value');
  for (const i of v.paths) if (!PIDS.has(i)) E(`anatomy/${v.stage}/${v.value.slice(0, 40)}`, `path ${i} not found`);
}

// ───────────────────────── context note: cites must be verified
for (const n of cites(contextNoteRaw)) if (!isVerified(n)) E('context-note.md', `[${n}] is not a verified reference`);

// ───────────────────────── UI-27 card chips (computed here so the path page stays light)
// Molecules: a record joins a card when the path is in its `paths` and the card is its `stage` (app-methods §2.3).
// `also_named_in` mentions are listed on the sheet only (KICKOFF §8.6), never placed on a card.
// Small molecules: the "named in the pack: X in PD01 (…) and PD02" line places X on the card whose value contains X;
// failing that, on a stage the parenthesis names; otherwise it is listed under the path's row. Each chip says how.
type Chip = { kind: 'molecule' | 'small'; id: string; name: string | null; how: string; as_written?: string | null; mapping: boolean; mapping_text?: string | null };
const stageChips: Record<string, { stages: Record<string, Chip[]>; unplaced: Chip[] }> = {};
const chipsOf = (pid: string) => (stageChips[pid] ??= { stages: {}, unplaced: [] });
const addChip = (pid: string, stage: string, c: Chip) => {
  const st = (chipsOf(pid).stages[stage] ??= []);
  if (!st.some((x) => x.kind === c.kind && x.id === c.id)) st.push(c);
};
for (const m of molecules) {
  if (!STAGE_FIELDS.includes(m.stage)) continue; // "notes" records have no card
  for (const pid of m.paths) if (PIDS.has(pid)) addChip(pid, m.stage, { kind: 'molecule', id: m.id, name: m.uniprot.protein_name ?? null, how: 'molecules.yaml lists this path at this stage', as_written: m.as_written, mapping: true, mapping_text: m.mapping });
}
const PID_RE = /\bP[A-Z]{1,3}\d{2}\b/g;
for (const g of small) {
  const name = g.pubchem.Title ?? g.forms.find((f) => f.title)?.title ?? `CID ${g.pubchem.CID}`;
  for (const line of g.sources) {
    const m0 = line.match(/^named in the pack:\s*(.*)$/s);
    if (!m0) continue;
    const how = m0[1].replace(/\s+/g, ' ');
    const body = how.replace(/\(curator mapping[^)]*\)?\s*$/, '');
    const as = body.split(/\s+in\s+P[A-Z]{1,3}\d{2}\b/)[0].trim();
    for (const pm of body.matchAll(PID_RE)) {
      const pid = pm[0];
      const p = pathById.get(pid);
      if (!p) {
        E(`small-molecules/${g.id}`, `named in ${pid}, which is not a path`);
        continue;
      }
      const after = body.slice((pm.index ?? 0) + pid.length).match(/^\s*\(([^)]*)\)/)?.[1] ?? '';
      const chip: Chip = { kind: 'small', id: g.id, name, how, mapping: true };
      const byValue = STAGE_FIELDS.find((st) => as && String((p as any)[st] ?? '').toLowerCase().includes(as.toLowerCase()));
      const byWord = STAGE_FIELDS.find((st) => new RegExp(`\\b${st.replace('_', '[ _]')}\\b`, 'i').test(after));
      const st = byValue ?? byWord;
      if (st) addChip(pid, st, chip);
      else if (!chipsOf(pid).unplaced.some((x) => x.id === g.id)) chipsOf(pid).unplaced.push(chip);
    }
  }
}

// ───────────────────────── upkeep + staleness (SUSTAIN §1, §4)
const classes = new Map((upkeep?.classes ?? []).map((c) => [c.id, c]));
type Stale = { class: string; record: string; checked: string; age: number; recheck_days: number };
const stale: Stale[] = [];
const ageCheck = (cls: string, record: string, d: string | null) => {
  const c = classes.get(cls);
  if (!c) return W(`upkeep`, `class ${cls} is not declared`);
  if (!d) return W(`upkeep/${cls}`, `${record} has no date`);
  const a = ageDays(d)!;
  if (a > c.recheck_days) stale.push({ class: cls, record, checked: d, age: a, recheck_days: c.recheck_days });
};
ageCheck('curation', 'curated rows (source/curation/paths.yaml)', day(manifest?.sources.curation.curated));
for (const r of references) if (r.harvested_on) ageCheck('reference', `reference [${r.n}]`, day(r.harvested_on));
for (const m of molecules) {
  ageCheck('molecule', `${m.id} (UniProt ${m.uniprot.accession})`, day(m.uniprot.retrieved_on));
  for (const e of m.pdb_entries) ageCheck('structure', `${m.id} · PDB ${e.id}`, day(e.retrieved_on));
  for (const a of m.alphafold) ageCheck('structure', `${m.id} · ${a.entryId}`, day(a.retrieved_on));
}
for (const g of small) ageCheck('small-molecule', `${g.id} (PubChem)`, day(g.retrieved_on));
// pack 0.2 folds Plant Ontology into the `ontology` class with the glossary's GO and ChEBI records
for (const v of anatomyF?.values ?? []) for (const t of v.terms) if (t.id) ageCheck('ontology', `${t.id} (${t.label})`, day(t.retrieved_on));

// ───────────────────────── upkeep → freshness (SUSTAIN 0.2.1, UI-34; pattern from PPE's build)
// The build records dates only; age and staleness are computed in the reader's browser (perception-core freshness.ts).
const upkeepClasses: UpkeepClass[] = (upkeep?.classes ?? []).map((c) => ({ ...c, as_of: day(c.as_of) }));
for (const c of upkeepClasses) {
  if (!c.files?.length) W(`upkeep/${c.id}`, 'names no files: Methods → Freshness cannot list its records');
  for (const f of c.files ?? []) if (!has(f)) E(`upkeep/${c.id}`, `file ${f} not found`);
}
const WHOLE_FILE_ROUTE: Record<string, string> = { 'paths.yaml': '/evidence', 'hierarchy.yaml': '/tree', 'hubs.yaml': '/shared', 'legend.yaml': '/methods', 'structures.yaml': '/molecules' };
const PART_LABEL: Record<string, string> = { uniprot: 'UniProt', pdb_entries: 'PDB entries', alphafold: 'AlphaFold DB' };
const freshness = collectFreshness(upkeepClasses, (f) => (has(f) ? loadYaml(f, false) : undefined), (file, r, id, part) => {
  if (!r) return { label: `${file} (whole file, as of)`, route: WHOLE_FILE_ROUTE[file] ?? null };
  switch (file) {
    case 'molecules.yaml': return { label: `${id} · ${PART_LABEL[part] ?? part}`, route: `/molecules/${encodeURIComponent(id!)}` };
    case 'structures.yaml': return { label: `structure ${id}`, route: `/structures/${encodeURIComponent(id!)}` };
    case 'small-molecules.yaml': return { label: `${r.pubchem?.Title ?? id} (PubChem)`, route: `/molecules/sm/${encodeURIComponent(id!)}` };
    case 'references.yaml': return { label: `reference [${id}]`, route: `/references#ref-${id}` };
    case 'glossary.yaml': return { label: `glossary: ${r.term ?? id}`, route: `/glossary#${id}` };
    case 'anatomy.yaml': return { label: `anatomy: ${r.value} (${r.stage})`, route: r.paths?.[0] ? `/path/${r.paths[0]}` : null };
  }
  return undefined;
});
for (const e of freshness.records) if (!/^\d{4}-\d{2}-\d{2}$/.test(e.checked)) W(`upkeep/${e.class}`, `${e.label}: date '${e.checked}' is not YYYY-MM-DD`);

// ───────────────────────── glossary (UI-32, app-methods §11): checks; "Used in" is computed with the core's own matcher
const glossaryIn: GlossEntry[] = parse('glossary.yaml', S.Glossary, glossaryRaw === undefined ? [] : Array.isArray(glossaryRaw) ? glossaryRaw : glossaryRaw?.terms ?? []) ?? [];
{
  const seen = new Set<string>();
  for (const g of glossaryIn) {
    if (seen.has(g.id)) E(`glossary/${g.id}`, 'duplicate id');
    seen.add(g.id);
    if (g.basis === 'ontology, verbatim' && !g.definition_source) E(`glossary/${g.id}`, 'basis is ontology, verbatim but definition_source is missing');
    if (g.basis === 'cited abstracts') {
      const ns = [...cites(g.definition)];
      if (!ns.length) E(`glossary/${g.id}`, 'cited abstracts definition has no [n] citation');
      for (const n of ns) if (!REF.has(n)) E(`glossary/${g.id}`, `reference [${n}] not in references.yaml`);
      else if (!isVerified(n)) E(`glossary/${g.id}`, `reference [${n}] is not verified: it cannot back a definition`);
    }
  }
}

// ───────────────────────── concepts (UI-33, app-methods §12): the 101s in concepts/*.md
const conceptFiles = has('concepts') ? fs.readdirSync(path.join(PACK, 'concepts')).filter((f) => f.endsWith('.md')).sort() : [];
const conceptsIn: Concept[] = [];
for (const f of conceptFiles) {
  const where = `concepts/${f}`;
  const { frontmatter, sections } = parseConceptBody(fs.readFileSync(path.join(PACK, 'concepts', f), 'utf8'));
  if (frontmatter == null) {
    E(where, 'no frontmatter');
    continue;
  }
  let fmRaw: unknown;
  try {
    fmRaw = yaml.load(frontmatter, { schema: PACK_SCHEMA });
  } catch (e: any) {
    E(where, `YAML error — ${e.message}`);
    continue;
  }
  const fm = parse(where, S.ConceptFrontmatter, fmRaw ?? {});
  if (!fm) continue;
  if (fm.id !== f.replace(/\.md$/, '')) E(where, `id ${fm.id} must match the file name`);
  if ((fm as any).self_check && !(manifest as any)?.concept_self_checks) W(where, 'self_check present but manifest.concept_self_checks is not true: not shown');
  if (!sections.some((s) => s.blocks.length)) E(where, 'no body');
  conceptsIn.push({ id: fm.id, title: fm.title, one_liner: fm.one_liner, why_here: fm.why_here, prerequisites: fm.prerequisites, terms: fm.terms, sections, next: [] });
}
const conceptIds = new Set(conceptsIn.map((c) => c.id));
const glossIds = new Set(glossaryIn.map((g) => g.id));
for (const c of conceptsIn) {
  const where = `concepts/${c.id}`;
  for (const p of c.prerequisites) if (!conceptIds.has(p)) E(where, `prerequisite ${p} is not a 101 in concepts/`);
  for (const t of c.terms) if (!glossIds.has(t)) E(where, `term ${t} is not a glossary id`);
  for (const s of c.sections)
    for (const b of s.blocks) {
      for (const n of b.cites) {
        if (!REF.has(n)) E(where, `reference [${n}] not in references.yaml`);
        else if (!isVerified(n)) E(where, `reference [${n}] is not verified: it cannot back a 101`);
      }
      // science prose: every paragraph is cited (app-methods §12.1); framing paragraphs restate the app's own rules
      if (!b.framing && !b.cites.length) E(where, `"${s.heading ?? ''}": a science paragraph with no [n] and no framing marker`);
    }
}
for (const g of glossaryIn) if (g.concept && !conceptIds.has(g.concept)) E(`glossary/${g.id}`, `concept ${g.concept} is not a 101 in concepts/`);
const conceptsOut: Concept[] = orderConcepts(conceptsIn).map((c, _i, all) => ({ ...c, next: nextOf(c.id, all) }));

// "Used in": this pack's stage kinds and path fields; molecules by their UniProt names and function text
const PATH_TEXTS = ['sense_leaf', 'perception_branch', 'stimulus_origin', 'transducer_tier', 'row_status', 'evidence_species', 'notes'];
const strOf = (v: unknown) => (typeof v === 'string' ? v : Array.isArray(v) ? v.filter((x) => typeof x === 'string').join('; ') : '');
const usedIn = glossaryUsedIn(glossaryIn, {
  paths: paths.map((p: any) => ({
    id: p.path_id,
    stages: STAGE_FIELDS.map((k) => [k, strOf(p[k])] as [string, string]).filter(([, v]) => v),
    texts: PATH_TEXTS.map((k) => strOf(p[k])).filter(Boolean),
  })),
  molecules: molecules.map((m: any) => ({
    id: m.id,
    texts: [m.as_written, m.uniprot?.protein_name, ...((m.uniprot?.function ?? []) as { text: string }[]).map((f) => f.text)].map(strOf).filter(Boolean),
  })),
  pages: [
    ...interactions.map((x: any) => ({ label: `Interaction: ${x.title}`, href: `/interactions/${x.id}`, texts: [strOf(x.role)] })),
    ...(contextNoteRaw.trim() ? [{ label: 'About: context note', href: '/about#context-note', texts: [contextNoteRaw.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '')] }] : []),
  ],
});
// A path with a value in a field uses the glossary term named after that field (signal_route → "Signal route"), as in PPE
{
  const byTerm = new Map(glossaryIn.map((g) => [g.term.toLowerCase(), g.id]));
  const order = new Map(paths.map((p, i) => [p.path_id, i]));
  for (const k of new Set([...STAGE_FIELDS, ...PATH_TEXTS])) {
    const id = byTerm.get(k.replace(/_/g, ' '));
    if (!id) continue;
    const u = usedIn[id];
    for (const p of paths as any[]) if (strOf(p[k]) && !u.paths.includes(p.path_id)) u.paths.push(p.path_id);
    u.paths.sort((a, b) => order.get(a)! - order.get(b)!);
  }
}
const glossaryOut = glossaryIn.map((g) => ({ ...g, definition_source: g.definition_source ? { ...g.definition_source, retrieved_on: day(g.definition_source.retrieved_on) } : undefined, used_in: usedIn[g.id] }));

// ───────────────────────── safety lints over every rendered pack string (SAFETY H1 mechanism, app_lints)
const lints: Lint[] = safety?.app_lints ?? [];
if (safety?.blocked_phrases.length) lints.push({ id: 'H1', phrases: safety.blocked_phrases, allowed_phrases: safety.allowed_phrases });
type Withheld = { where: string; lint: string; phrase: string; excerpt: string };
const withheld: Withheld[] = [];
const WITHHELD = (lint: string) => `TODO(author): withheld by the ${lint} wording lint — listed on Methods.`;
/** a pack string that would render: linted; on a hit it is withheld and the hit recorded as an error */
function screen(where: string, s: string): string {
  const hits = lintHits(s, lints);
  if (!hits.length) return s;
  for (const h of hits) {
    withheld.push({ where, lint: h.lint, phrase: h.phrase, excerpt: s.replace(/\s+/g, ' ').slice(0, 160) });
    // the rendered message names the lint, never the phrase (it would trip the same lint on Methods); the exact
    // phrase is in content-pack/BUILD-ERRORS.md
    E(where, `withheld: it uses a phrase the ${h.lint} lint blocks, and no allowed_phrases entry in safety.yaml covers it (exact phrase in content-pack/BUILD-ERRORS.md)`);
  }
  // a molecule mapping keeps its "curator mapping:" label (the core shows it as a chip)
  const keep = s.match(/^curator mapping:\s*/i)?.[0] ?? '';
  return keep + WITHHELD(hits[0].lint);
}

// context note (the About framing): strip frontmatter and comments, screen paragraph by paragraph, then link [n] cites
let contextNote = contextNoteRaw.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<!--[\s\S]*?-->/g, '').trim() + '\n';
{
  let section = '';
  contextNote = contextNote
    .split(/\n\s*\n/)
    .flatMap((b) => {
      const h = b.match(/^#{1,4}\s+(.*)$/m);
      if (h) section = h[1].trim();
      // list items are screened one by one so one item's hit does not hide its siblings
      const items = /^\s*[-*]\s/m.test(b) && !h ? b.split(/\n(?=\s*[-*]\s)/) : [b];
      return [
        items
          .map((it) => {
            const marker = it.match(/^(\s*(?:\d+\.|[-*])\s+)/)?.[1] ?? '';
            const out = screen(`context-note.md § ${section || 'intro'}`, it);
            return out === it ? it : `${marker}${out}`;
          })
          .join('\n'),
      ];
    })
    .join('\n\n');
  // link each citation to the references page with the citation's short label from references.yaml
  contextNote = contextNote.replace(/\[(\d+)\](?!\()/g, (all, n) => {
    const r = REF.get(+n);
    if (!r) return all;
    // the short label is the citation up to its year ("Taiz et al. 2019"), from references.yaml
    const label = r.citation.match(/^(.*?\b(?:19|20)\d{2}[a-z]?)\./)?.[1] ?? r.citation.split('. ')[0];
    return `[\\[${n}\\] ${label}](#/references)`;
  });
}

// ───────────────────────── strings: pack ui-strings, plus the core's key names where they differ (labels only)
// KEPT (K40): perception-core 0.3.0 still reads badges["<model label>_only"] (the 🌱 badge's title and screen-reader text,
// components/ui/badges.tsx) and badges["non_<reference label>"] (the viewer's organism chip, Viewer.tsx); this pack names
// them other_species and non_reference. Without these two keys w7 turns red ("not Arabidopsis" is lost from the badge).
const badges = { ...(uiStrings?.badges ?? {}) } as Record<string, string>;
if (manifest && badges.other_species) badges[`${manifest.evidence_species.model.label}_only`] = badges.other_species.replace(/^\{species\}\s*/, '').replace(/\s*🌱\s*$/, '');
if (manifest && badges.non_reference) badges[`non_${manifest.reference_organism.label}`] = badges.non_reference;
const strings = {
  ...uiStrings,
  badges,
  notice: safety?.notice ?? null,
  caution: hubsF?.caution ?? null,
};

// ───────────────────────── emit
const refsOut = references.map((r) => ({
  n: r.n, key: r.key, citation: r.citation, year: r.year, tier: r.tier, doi: r.doi ?? null, url: r.url ?? null, isbn: r.isbn ?? null, pmid: r.pmid ?? null,
  verified: r.verified, verified_how: r.verified_how ?? null, verified_via: r.verified_via ?? null, abstract: r.abstract ?? null, abstract_source: r.abstract_source ?? null,
  harvested_on: day(r.harvested_on), openalex: null, source: r.verified_via ?? null, correction_note: null, handoff_status: null, candidate_for: null,
  abstract_note: r.abstract_note ?? null, evidence_role: null, evidence_role_classified: false, cited_by_paths: r.cited_by_paths,
}));
const molOut = molecules.map((m) => ({ ...m, uniprot: { ...m.uniprot, retrieved_on: day(m.uniprot.retrieved_on) } }));

const files: Record<string, unknown> = {
  'manifest.json': manifest
    ? {
        ...manifest,
        // perception-core 0.3.0 matches evidence_species patterns case-insensitively and About reads sources.curation;
        // branch colours come from the theme's --cat-1…16 (src/index.css), so no palette is emitted from the pack
        palette: { branches: {} },
      }
    : null,
  'audience.json': audience ?? null,
  'scenarios.json': scenarios ?? [],
  'strings.json': strings,
  'paths.json': paths,
  'percepts.json': [], // no percepts in this app (app-requirements §3.5)
  'hierarchy.json': hierarchy?.tree ?? null,
  'hubs.json': hubsF ? { caution: hubsF.caution, hubs: hubsOut } : null,
  'proposed.json': { status: 'none — this pack has no proposed routes (app-requirements §2.2)', nodes: [], edges: [] },
  'legend.json': legendF ?? null,
  'review.json': [],
  'molecules.json': molOut,
  'molecules-index.json': molecules.map((m) => ({
    id: m.id, kind: m.kind, as_written: m.as_written, paths: m.paths, complex: null, stage: m.stage,
    // symbol = the record id (the curator's symbol); aliases = UniProt gene names and AGI loci, verbatim (search, app-methods §10)
    symbol: m.id, name: m.uniprot.protein_name ?? null,
    alias_symbol: [...new Set([...m.uniprot.gene_names, ...m.uniprot.ordered_locus_names])].filter((x) => x !== m.id), prev_symbol: [],
    accession: m.uniprot.accession, protein_name: m.uniprot.protein_name ?? null,
    featured: m.featured, pdb_ids: m.pdb_entries.map((e) => e.id), n_pdb: m.pdb_entries.length, has_alphafold: m.alphafold.length > 0, n_members: 0,
  })),
  'structures.json': structures,
  'stage-chips.json': stageChips,
  'anatomy.json': anatomyF ? anatomyF.values.map((v) => ({ ...v, terms: v.terms.map((t) => ({ ...t, retrieved_on: day(t.retrieved_on) })) })) : null,
  'small-molecules.json': { molecules: small.map((g) => ({ ...g, retrieved_on: day(g.retrieved_on) })), not_found: smallF?.not_found ?? [] },
  'interactions.json': interactions,
  'curation.json': curation ? { ...curation, animal_taxa: [] } : null,
  'references.json': refsOut,
  // perception-core 0.2.0 reads the ledger oldest first (Methods → Recent changes shows its last ten, newest first);
  // the pack writes it newest first, so it is reversed here. `by` and `source` are not rendered.
  'changes.json': [...changes].reverse().map((c) => ({ date: day(c.date), version: c.version, what: c.what, ...(c.why ? { why: c.why } : {}), records: c.records })),
  'glossary.json': glossaryOut,
  'concepts.json': conceptsOut,
  'freshness.json': freshness,
  'todo.json': todo.map((t) => ({ id: t.id, what: t.what, where: t.where ?? '' })), // owner is not rendered
  'upkeep.json': upkeep ?? null,
  'scope.json': scope,
  'planner.json': planner ?? null,
  'thumbs.json': {},
};

/**
 * UI-31: text shown verbatim from a named source (abstracts; UniProt, RCSB, AlphaFold DB, PubChem and Plant Ontology
 * fields) is not the app's prose and is not linted or withheld. Curator-written fields are.
 */
const VERBATIM: [string, RegExp][] = [
  ['references.json', /\.abstract$/],
  ['molecules.json', /\.(uniprot\.(?!source|retrieved_on).*|pdb_entries\[\d+\]\.(?!source|retrieved_on).*|alphafold\[\d+\]\..*)$/],
  ['small-molecules.json', /\.(pubchem\.\w+|forms\[\d+\]\.title)$/],
  ['anatomy.json', /\.terms\[\d+\]\.(label|definition|synonyms\[\d+\]|parents\[\d+\]\.label)$/],
];
// freshness.json holds dates and labels built from record ids (no pack prose); upkeep.json's `how` is shown on Methods
const NOT_RENDERED = new Set(['scenarios.json', 'scope.json', 'planner.json', 'audience.json', 'thumbs.json', 'freshness.json']);
// a glossary definition with basis 'ontology, verbatim' is quoted from its record (UI-31, app-methods §11.1), as is its label
const GLOSS_VERBATIM = new Set(glossaryIn.filter((g) => g.basis === 'ontology, verbatim').map((g) => g.id));
const isVerbatim = (f: string, p: string) =>
  VERBATIM.some(([vf, re]) => vf === f && re.test(p)) ||
  (f === 'glossary.json' && (() => { const m = p.match(/^\[([a-z0-9-]+)\]\.(definition|definition_source\.label)$/); return !!m && GLOSS_VERBATIM.has(m[1]); })());
function screenAll(o: unknown, f: string, p: string): unknown {
  if (typeof o === 'string') return isVerbatim(f, p) ? o : screen(`${f}:${p}`, o);
  // top-level records are named by their id (paths.json:PD01.notes), not their index
  const key = (v: any, i: number) => (p === '' && v && typeof v === 'object' && (v.path_id ?? v.id)) || i;
  if (Array.isArray(o)) return o.map((v, i) => screenAll(v, f, `${p}[${key(v, i)}]`));
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, screenAll(v, f, p ? `${p}.${k}` : k)]));
  return o;
}
// a location is named by its pack file; the open-items file is named in words (its file name is itself a jargon term)
const LOC: Record<string, string> = { 'todo.json': 'open items' };
for (const [f, data] of Object.entries(files)) if (!NOT_RENDERED.has(f)) files[f] = screenAll(data, LOC[f] ?? f, '');
files['context-note.json'] = { markdown: contextNote, withheld: withheld.filter((w) => w.where.startsWith('context-note')).map((w) => ({ where: w.where, lint: w.lint, excerpt: w.excerpt.split(new RegExp(w.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')).join('…') })) };

// a hit that still renders would be a safety failure: check the screened output once more
let fatal = 0;
for (const [f, data] of Object.entries(files)) {
  if (NOT_RENDERED.has(f)) continue;
  const walk = (o: unknown, p: string) => {
    if (typeof o === 'string') {
      if (!isVerbatim(f, p) && lintHits(o, lints).length) fatal++;
    } else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${p}[${i}]`));
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(data, '');
}

const errorsN = problems.filter((p) => p.level === 'error').length;
const warnsN = problems.length - errorsN;
const buildErrors = { generated_for: TODAY, errors: problems.filter((p) => p.level === 'error'), warnings: problems.filter((p) => p.level === 'warning') };
files['build-errors.json'] = buildErrors;

const GAP_FIELDS = STAGE_FIELDS;
const safetySummaryPath = path.join(ROOT, 'tests', 'results', 'summary.json');
const safetySummary = fs.existsSync(safetySummaryPath) ? JSON.parse(fs.readFileSync(safetySummaryPath, 'utf8')) : { status: 'not yet recorded' };
const provenance = {
  slug: manifest?.slug,
  as_of: manifest?.as_of,
  built_for: TODAY,
  pack: { version: manifest?.pack_version, core_schema: manifest?.core_schema, builder: manifest?.builder, sources: manifest?.sources },
  counts: {
    paths: paths.length,
    paths_by_tier: count(paths, (p) => p.transducer_tier),
    paths_by_row_status: count(paths, (p) => p.row_status ?? 'null'),
    paths_by_branch: count(paths, (p) => p.perception_branch),
    gaps_total: paths.reduce((a, p) => a + GAP_FIELDS.filter((f) => (p as any)[f] == null).length, 0),
    paths_with_contested: paths.filter((p) => p.contested_fields.length).length,
    paths_with_a_verified_ref: paths.filter((p) => p.refs.some(isVerified)).length,
    dual_membership: paths.filter((p) => p.also_in.length).map((p) => p.path_id),
    percepts: 0,
    hubs: hubsOut.length,
    proposed_nodes: 0,
    proposed_edges: 0,
    review_items: 0,
    molecules: molecules.length,
    molecules_by_kind: count(molecules, (m) => m.kind),
    molecules_by_stage: count(molecules, (m) => m.stage),
    pdb_entries_listed: molecules.reduce((a, m) => a + m.pdb_entries.length, 0),
    structures_bundled: structures.length,
    structures_by_kind: count(structures, (s) => s.kind),
    structures_by_source: count(structures, (s) => s.source_db),
    interactions: interactions.length,
    interactions_by_kind: count(interactions, (x) => x.kind),
    small_molecules: small.length,
    small_molecules_hidden_by_default: small.filter((g) => g.hidden_by_default).length,
    small_molecules_not_found: smallF?.not_found.length ?? 0,
    anatomy_values: anatomyF?.values.length ?? 0,
    anatomy_terms: (anatomyF?.values ?? []).reduce((a, v) => a + v.terms.filter((t) => t.id).length, 0),
  },
  references: {
    total: references.length,
    by_tier: count(references, (r) => r.tier),
    verified: references.filter((r) => r.verified).length,
    unverified: references.filter((r) => !r.verified).length,
    with_abstract: references.filter((r) => r.abstract).length,
    by_source: count(references, (r) => r.verified_via ?? 'unknown'),
  },
  todo: todo.length,
  glossary_terms: glossaryOut.length,
  glossary_by_basis: count(glossaryOut, (g) => g.basis),
  concepts: conceptsOut.length,
  heuristics: [
    { id: 'n-paths', label: uiStrings?.labels?.n_paths ?? null, where: 'shared hardware, molecule sheets, navigator node size' },
    { id: 'computed-contacts', label: uiStrings?.labels?.computed_contacts ?? null, where: 'structure viewer (contacts around a selection)' },
    { id: 'curator-mapping', label: uiStrings?.badges?.curator_mapping ?? null, where: 'molecule-to-path mapping, small-molecule names, Plant Ontology terms' },
    { id: 'featured-structure', label: 'Featured: the rule step that chose it (app-methods §4.4)', where: 'molecule sheets' },
  ],
  build: { errors: errorsN, warnings: warnsN, withheld_passages: withheld.length },
  safety_tests: safetySummary,
  staleness: { stale: stale.length, as_of: TODAY },
};
const staleness = { as_of: TODAY, classes: upkeep?.classes ?? [], stale };
files['provenance.json'] = provenance;
files['staleness.json'] = staleness;

if (!DRY) {
  let written = 0;
  const writeIf = (p: string, s: string | Buffer) => {
    if (fs.existsSync(p) && Buffer.compare(fs.readFileSync(p), Buffer.from(s as any)) === 0) return;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, s);
    written++;
  };
  for (const [f, data] of Object.entries(files)) writeIf(path.join(OUT, f), JSON.stringify(data, null, 1) + '\n');
  writeIf(path.join(PUB, 'provenance.json'), JSON.stringify(provenance, null, 1) + '\n');
  writeIf(path.join(PUB, 'staleness.json'), JSON.stringify(staleness, null, 1) + '\n');
  // the full ledger, linked from Methods → Recent changes (screened like every rendered file)
  writeIf(path.join(PUB, 'changes.json'), JSON.stringify(files['changes.json'], null, 1) + '\n');
  writeIf(path.join(PUB, 'freshness.json'), JSON.stringify(freshness, null, 1) + '\n');
  for (const c of copyPlan) {
    if (fs.existsSync(c.dest) && sha(c.dest) === sha(c.src)) continue;
    fs.mkdirSync(path.dirname(c.dest), { recursive: true });
    fs.copyFileSync(c.src, c.dest);
    written++;
  }
  const md = [
    '# BUILD-ERRORS — written by scripts/build-content.ts',
    '',
    `Build for ${TODAY}: ${errorsN} error(s), ${warnsN} warning(s). Surfaced on #/methods. The build never edits the pack; fix the source and re-run.`,
    '',
    '## Errors',
    '',
    ...(buildErrors.errors.length ? buildErrors.errors.map((p) => `- \`${p.where}\` — ${p.message}`) : ['- none']),
    '',
    '## Warnings',
    '',
    ...(buildErrors.warnings.length ? buildErrors.warnings.map((p) => `- \`${p.where}\` — ${p.message}`) : ['- none']),
    '',
    '## Withheld strings (exact phrase and the text withheld)',
    '',
    ...(withheld.length ? withheld.map((w) => `- \`${w.where}\` — '${w.phrase}' (${w.lint}): “${w.excerpt}”`) : ['- none']),
    '',
  ].join('\n');
  writeIf(path.join(PACK, 'BUILD-ERRORS.md'), md);

  const rows: [string, string | number][] = [
    ['paths (B1/B2/B3)', `${paths.length} (${['B1', 'B2', 'B3'].map((t) => provenance.counts.paths_by_tier[t] ?? 0).join('/')})`],
    ['paths with ⚑', provenance.counts.paths_with_contested],
    ['references (verified / abstracts)', `${references.length} (${provenance.references.verified} / ${provenance.references.with_abstract})`],
    ['molecules', `${molecules.length} (${Object.entries(provenance.counts.molecules_by_stage).map(([k, v]) => `${k} ${v}`).join(', ')})`],
    ['structures bundled', `${structures.length} (${Object.entries(provenance.counts.structures_by_source).map(([k, v]) => `${k} ${v}`).join(', ')}; ${copyPlan.length} files ok)`],
    ['shared hardware', hubsOut.length],
    ['small molecules (hidden / not found)', `${small.length} (${provenance.counts.small_molecules_hidden_by_default} / ${provenance.counts.small_molecules_not_found})`],
    ['anatomy values / PO terms', `${provenance.counts.anatomy_values} / ${provenance.counts.anatomy_terms}`],
    ['glossary terms / 101s', `${glossaryOut.length} / ${conceptsOut.length}`],
    ['freshness records (classes)', `${freshness.records.length} (${freshness.classes.length})`],
    ['gaps', provenance.counts.gaps_total], ['todo', todo.length], ['stale facts', stale.length], ['withheld strings', withheld.length],
    ['errors / warnings', `${errorsN} / ${warnsN}`], ['files rewritten', written],
  ];
  console.log('build-content · ' + (manifest?.slug ?? '?') + ' · as of ' + TODAY);
  for (const [k, v] of rows) console.log('  ' + k.padEnd(38) + String(v));
  for (const p of problems) console.log(`  ${p.level === 'error' ? 'ERROR' : 'WARN '} ${p.where} — ${p.message}`);
} else {
  for (const p of problems) console.log(`${p.level === 'error' ? 'ERROR' : 'WARN '} ${p.where} — ${p.message}`);
  console.log(`${errorsN} error(s), ${warnsN} warning(s)`);
}
if (fatal) {
  console.error(`build-content: ${fatal} safety-lint hit(s) would still render — failing.`);
  process.exit(2);
}
if (DRY && errorsN) process.exit(1);
