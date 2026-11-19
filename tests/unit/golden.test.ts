// Golden numbers from content-pack/app-methods.md and KICKOFF §8.4 (pack 0.1), checked through perception-core's own
// rules over this app's content-build output. A drift is a failure; never widen a tolerance.
import { describe, expect, it } from 'vitest';
import { pack, graph, rules, type Molecule, type PathRow } from './core';
const P = (await pack.packData('paths')) as PathRow[];
const M = (await pack.packData('molecules')) as (Molecule & { stage: string; also_named_in?: Record<string, string[]> })[];
const hubs = (await pack.packData('hubs')) as { caution: string; hubs: { molecule: string; n_paths: number }[] };
const structures = (await pack.packData('structures')) as { id: string; source_db: string; kind: string; molecules: string[] }[];
const small = (await pack.packData('small-molecules')) as { molecules: { id: string; hidden_by_default: boolean; classes: string[] }[]; not_found: unknown[] };
const anatomy = (await pack.packData('anatomy')) as { terms: { id: string | null }[] }[];
const refs = (await pack.packData('references')) as { verified: boolean; abstract: string | null }[];
const tree = (await pack.packData('hierarchy')) as any;
const byId = new Map(P.map((p) => [p.path_id, p]));
const tally = <T,>(xs: T[], k: (x: T) => string) => xs.reduce<Record<string, number>>((a, x) => ((a[k(x)] = (a[k(x)] ?? 0) + 1), a), {});

describe('paths (§1, §6)', () => {
  it('67 curated paths; PT07 (dropped) and PZ08 (About page) stay out', () => {
    expect(P.length).toBe(67);
    expect(byId.has('PT07')).toBe(false);
    expect(byId.has('PZ08')).toBe(false);
    expect(P.every((p) => p.row_status === 'curated')).toBe(true);
  });
  it('tiers B1 33 · B2 17 · B3 17', () => expect(tally(P, (p) => p.transducer_tier)).toEqual({ B1: 33, B2: 17, B3: 17 }));
  it('21 rows carry ⚑ in some field', () => expect(P.filter((p) => Object.values(p).some((v) => typeof v === 'string' && v.includes('⚑'))).length).toBe(21));
  it('the evidence-table ⚑ filter returns the same 21', () => expect(rules.filterPaths(P, { contested: true }).length).toBe(21));
  it('dual membership: PL02, PT05, PX05', () => {
    expect(P.filter((p) => (p.also_in as string[]).length).map((p) => p.path_id).sort()).toEqual(['PL02', 'PT05', 'PX05']);
    const leaves: string[] = [];
    const walk = (n: any) => { if (n.dual) leaves.push(...n.path_ids); (n.children ?? []).forEach(walk); };
    walk(tree);
    expect(leaves.sort()).toEqual(['PL02', 'PT05', 'PX05']);
  });
  it('PD01 has a null signal_route (gap, w12)', () => {
    expect(byId.get('PD01')!.signal_route).toBeNull();
    expect(rules.gapFields(byId.get('PD01')!)).toContain('signal_route');
  });
  it('PL07 has 2 gaps: signal route and integration (w3)', () => expect(rules.gapFields(byId.get('PL07')!)).toEqual(['signal_route', 'integration']));
  it('PW01 has no gap (w1)', () => expect(rules.gapCount(byId.get('PW01')!)).toBe(0));
});

describe('evidence species (§3)', () => {
  const cls = (id: string) => rules.speciesClass(byId.get(id)!.evidence_species);
  it('other species only: PS01 PS02 PZ02 PZ03 PZ07', () => expect(P.filter((p) => rules.speciesClass(p.evidence_species) === rules.MODEL_ONLY).map((p) => p.path_id).sort()).toEqual(['PS01', 'PS02', 'PZ02', 'PZ03', 'PZ07']));
  it('mixed: PSI01 PZ04', () => expect(P.filter((p) => rules.speciesClass(p.evidence_species) === 'mixed').map((p) => p.path_id).sort()).toEqual(['PSI01', 'PZ04']));
  it('every other row is Arabidopsis', () => expect(P.filter((p) => rules.speciesClass(p.evidence_species) === rules.REFERENCE).length).toBe(67 - 7));
  it('PS01 is other species; PD01 is Arabidopsis', () => {
    expect(cls('PS01')).toBe('other species-only');
    expect(cls('PD01')).toBe('Arabidopsis');
  });
});

describe('molecules and structures (§4)', () => {
  it('120 molecules: receptor 65, cascade 44, integration 9, response 1, notes 1', () => {
    expect(M.length).toBe(120);
    expect(tally(M, (m) => m.stage)).toEqual({ receptor: 65, cascade: 44, integration: 9, response: 1, notes: 1 });
  });
  it('every molecule carries an explicit stage (the core default is never relied on)', () => expect(M.every((m) => typeof m.stage === 'string' && m.stage.length > 0)).toBe(true));
  it('116 bundled structures: 50 PDB, 66 AlphaFold; every AlphaFold model is predicted', () => {
    expect(structures.length).toBe(116);
    expect(tally(structures, (s) => s.source_db)).toEqual({ PDB: 50, AlphaFoldDB: 66 });
    expect(structures.filter((s) => s.source_db === 'AlphaFoldDB').every((s) => s.kind === 'predicted')).toBe(true);
  });
  it('UVR8 featured 4D9S (curator override); PHOT1 2Z6C, domain structure (129 of 996 residues)', () => {
    const f = (id: string) => M.find((m) => m.id === id)!.featured as any;
    expect(f('UVR8').id).toBe('4D9S');
    expect(f('PHOT1').id).toBe('2Z6C');
    expect(f('PHOT1').coverage).toBe('domain structure (129 of 996 residues)');
  });
  it('NFR5 is the one unreviewed UniProt record (Lotus japonicus)', () => expect(M.filter((m) => !(m.uniprot as any).reviewed).map((m) => [m.id, (m.uniprot as any).organism])).toEqual([['NFR5', 'Lotus japonicus']]));
});

describe('the navigator graph over the pack (§2)', () => {
  const g = graph.deriveGraph(P, M as any);
  it('molecule nodes only at the receptor stage, only for receptor-stage records', () => {
    const molNodes = [...g.nodes.values()].filter((n) => n.kind === 'molecule');
    expect(molNodes.every((n) => n.stage === 'receptor')).toBe(true);
    const receptorIds = new Set(M.filter((m) => m.stage === 'receptor').map((m) => m.id));
    expect(molNodes.every((n) => receptorIds.has(n.molecule!))).toBe(true);
  });
  it('PD01 receptor: PYR1, PYL9, ABI1; PW01 receptor: GLR3.3, GLR3.6, GLR3.2, MSL10', () => {
    const ids = (pid: string) => g.chains.get(pid)!.find((c) => c.stage === 'receptor')!.nodeIds.map((x) => x.replace('mol::', '')).sort();
    expect(ids('PD01')).toEqual(['ABI1', 'PYL9', 'PYR1']);
    expect(ids('PW01')).toEqual(['GLR3.2', 'GLR3.3', 'GLR3.6', 'MSL10']);
  });
  it('also_named_in mentions never become nodes (GI is drawn only on its own stage)', () => {
    const gi = M.find((m) => m.id === 'GI')!;
    expect(gi.also_named_in).toEqual({ PCL01: ['cascade'] });
    const pcl01Cascade = g.chains.get('PCL01')!.find((c) => c.stage === 'cascade')!.nodeIds;
    expect(pcl01Cascade.some((id) => id.startsWith('mol::'))).toBe(false);
  });
  it('the PD01 edge across its null signal_route is dashed', () => {
    const e = [...g.edges.values()].filter((x) => x.gapPaths.includes('PD01'));
    expect(e.length).toBeGreaterThan(0);
    expect(e.every((x) => x.to.startsWith('integration::'))).toBe(true);
  });
});

describe('shared hardware (§5): 13 — PHYB 5, CRY1 4, PHOT1 3, PHOT2 3, the rest 2', () => {
  const n = Object.fromEntries(hubs.hubs.map((h) => [h.molecule, h.n_paths]));
  it('counts', () => {
    expect(hubs.hubs.length).toBe(13);
    expect(n).toEqual({ PHYB: 5, CRY1: 4, PHOT1: 3, PHOT2: 3, BCA1: 2, BCA4: 2, UVR8: 2, 'NRT1.1': 2, BAK1: 2, FLS2: 2, FER: 2, MSL10: 2, CRY2: 2 });
  });
  it('the caution says counts are not centrality', () => expect(hubs.caution).toMatch(/NOT centrality/));
});

describe('small molecules (§8), anatomy (§9), references (§1.2)', () => {
  it('41 small molecules, 9 hidden by default, 1 not found; chromophores visible', () => {
    expect(small.molecules.length).toBe(41);
    expect(small.molecules.filter((g) => g.hidden_by_default).length).toBe(9);
    expect(small.not_found.length).toBe(1);
    expect(small.molecules.filter((g) => g.classes.includes('chromophore')).every((g) => !g.hidden_by_default)).toBe(true);
  });
  it('51 stage values, 68 Plant Ontology terms', () => {
    expect(anatomy.length).toBe(51);
    expect(anatomy.reduce((a, v) => a + v.terms.filter((t) => t.id).length, 0)).toBe(68);
  });
  it('152 references, all verified, 151 with abstracts', () => {
    expect(refs.length).toBe(152);
    expect(refs.every((r) => r.verified)).toBe(true);
    expect(refs.filter((r) => r.abstract).length).toBe(151);
  });
});
