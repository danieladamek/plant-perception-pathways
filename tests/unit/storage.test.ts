// On-device workspace (ACTION-SPEC §4): save, load, migrate, clear; export/import round-trip; the evidence check on
// plant data (w9). Uses perception-core's storage, namespaced by this app's slug.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { pack, graph, maps, adapter, type Molecule, type PathRow } from './core';
const P = (await pack.packData('paths')) as PathRow[];
const M = (await pack.packData('molecules')) as Molecule[];
const ctx = { graph: graph.deriveGraph(P, M), claims: null, molecules: new Map(M.map((m) => [m.id, m])) };
const node = (label: string, kind: any, ref: any): any => ({ id: maps.uid(), label, kind, ref, note: '', pinned: false, x: 0, y: 0 });

function w9Map() {
  const m = maps.newMap('drought and CO2 crossover');
  const a = node('PYR1', 'molecule', 'PYR1');
  const b = node('SRK2E', 'molecule', 'SRK2E');
  const c = node('SLAC1', 'molecule', 'SLAC1');
  const f = node('my guard-cell model', 'free', null);
  m.nodes.push(a, b, c, f);
  for (const [x, y] of [[a, b], [b, c], [c, f]]) {
    const r = maps.checkLink(x, y, ctx);
    m.edges.push({ id: maps.uid('e'), from: x.id, to: y.id, note: '', basis: r.basis, ...(r.basis === 'curated' ? { paths: r.paths } : { override_reason: 'my hypothesis', override_at: '2026-11-19' }) });
  }
  return m;
}

describe('evidence check on plant data (w9)', () => {
  // perception-core 0.3.0 (K39 D16) resolves a cascade-stage molecule (SRK2E, SLAC1) to the stage node naming it on
  // each of its paths, and two molecules named on one stage of a path are backed by that path
  it('PYR1 → SRK2E and SRK2E → SLAC1 are curated; the free node link is an override', () => {
    const m = w9Map();
    expect(maps.counts(m)).toMatchObject({ n: 3, curated: 2, override: 1 });
    expect(m.edges[0].paths).toContain('PD01');
    expect(m.edges[1].paths).toEqual(expect.arrayContaining(['PD01', 'PCD01']));
    expect(m.edges[2].basis).toBe('override');
  });
});

describe('export / import round-trip', () => {
  it('JSON is lossless, with schema_version and pack_version', () => {
    const m = w9Map();
    const file = maps.toExport(m, '0.1');
    expect(file.schema_version).toBe(1);
    expect(file.pack_version).toBe('0.1');
    expect(maps.fromExport(JSON.stringify(file))).toEqual(m);
  });
  it('refuses a newer schema_version and a missing override reason, with clear messages', () => {
    const m = w9Map();
    expect(() => maps.fromExport(JSON.stringify({ ...maps.toExport(m, 'x'), schema_version: 99 }))).toThrow(/schema_version 99/);
    const bad = structuredClone(m);
    delete (bad.edges[2] as any).override_reason;
    expect(() => maps.fromExport(JSON.stringify(maps.toExport(bad, 'x')))).toThrow(maps.ImportError);
    expect(() => maps.fromExport('not json')).toThrow(/not valid JSON/);
  });
  it('migrates schema_version 0 without dropping fields', () => {
    const m = w9Map();
    const v0 = { schema_version: 0, map: { ...m, nodes: m.nodes.map(({ note, pinned, ...r }: any) => r), extra: 'kept' } };
    const back: any = maps.fromExport(JSON.stringify(v0));
    expect(back.extra).toBe('kept');
    expect(back.nodes.every((n: any) => n.note === '' && n.pinned === false)).toBe(true);
  });
  it('CSV edges and the Markdown report carry each link basis and the override reason', () => {
    const m = w9Map();
    expect(maps.toCsvEdges(m)).toMatch(/override/);
    const md = maps.toMarkdown(m, '0.1', 'Override: not backed by a curated path');
    expect(md).toMatch(/my hypothesis/);
    expect(md).toMatch(/override/i);
  });
});

describe('storage adapter (IndexedDB, localStorage fallback), keyed by the slug', () => {
  beforeEach(async () => adapter.clearAllData());
  it('namespace is the app slug', () => expect(adapter.SLUG).toBe('plant-perception-pathways'));
  it('save, load, list, duplicate, delete', async () => {
    const m = w9Map();
    await maps.saveMap(m);
    expect((await maps.loadMap(m.id))?.name).toBe(m.name);
    const d = await maps.duplicateMap(m.id);
    expect((await maps.listMaps()).length).toBe(2);
    await maps.deleteMap(d!.id);
    expect((await maps.listMaps()).map((x) => x.id)).toEqual([m.id]);
  });
  it('clear my data empties storage', async () => {
    await maps.saveMap(w9Map());
    await adapter.clearAllData();
    expect(await maps.listMaps()).toEqual([]);
  });
  it('localStorage fallback keeps keys under the slug', async () => {
    const kv = adapter.localKV();
    await kv.set('probe', { a: 1 });
    expect(localStorage.getItem('plant-perception-pathways:probe')).toBe('{"a":1}');
    expect(await kv.get('probe')).toEqual({ a: 1 });
    await kv.del('probe');
    expect(await kv.keys()).not.toContain('probe');
  });
});
