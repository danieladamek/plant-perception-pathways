// The navigator derivation (app-methods §2) on a tiny hand-written plant fixture, through perception-core's deriveGraph.
import { describe, expect, it } from 'vitest';
import { graph, rules } from './core';
import * as F from '../fixtures/plant-tiny';

describe('plant-tiny fixture (fixture: true)', () => {
  const g = graph.deriveGraph(F.paths as any, F.molecules as any);
  it('is marked as a fixture', () => expect(F.fixture).toBe(true));
  it('nodes: exactly the hand-written set', () => expect([...g.nodes.keys()].sort()).toEqual([...F.expected.nodes].sort()));
  it('edges: exactly the hand-written set', () => expect([...g.edges.keys()].sort()).toEqual([...F.expected.edges].sort()));
  it('the edge across the null cascade is dashed for T02 only', () => {
    for (const [id, e] of g.edges) expect(e.gapPaths).toEqual((F.expected.dashed as Record<string, string[]>)[id] ?? []);
    expect(g.chains.get('T02')!.find((c) => c.stage === 'cascade')!.nodeIds).toEqual([]);
  });
  it('one integration node for the string written two ways (trimmed, collapsed, case-insensitive)', () => {
    for (const [id, ps] of Object.entries(F.expected.shared)) expect(g.nodes.get(id)!.paths.sort()).toEqual(ps);
  });
  it('a cascade-stage molecule is never a node; a receptor text with no record is a text node', () => {
    expect(g.nodes.has('mol::FX-C1')).toBe(false);
    expect(g.nodes.get('receptor::text-only receptor c')!.kind).toBe('text');
  });
  it('the dual-membership row keeps one node set', () => expect([...g.nodes.values()].filter((n) => n.paths.includes('T02')).length).toBe(5));
  it('species classes: reference, other species, mixed', () => {
    for (const [pid, c] of Object.entries(F.expected.species)) expect(rules.speciesClass(F.paths.find((p) => p.path_id === pid)!.evidence_species as string)).toBe(c);
  });
});
