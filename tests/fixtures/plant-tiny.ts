/**
 * plant-tiny — a fixture, not data (fixture: true). Fictional placeholder rows in this app's path shape, for the
 * navigator derivation test (KICKOFF §8.4). Modelled on perception-core's plant-min fixture. Nothing here is a claim.
 *   3 paths · one shared integration string (written two ways) · one null stage (T02 cascade) ·
 *   one dual-membership row (T02) · one other-species row (T02) · one mixed row (T03) · one text-only receptor (T03)
 */
export const fixture = true;
const row = (o: Record<string, unknown>): Record<string, any> => ({
  perception_branch: 'Fixture branch one', stimulus_origin: 'external', transducer_tier: 'B2', hypothesis_group: null, row_status: 'curated',
  provenance: 'F', notes: null, key_citation: null, citation_verified: null, also_in: [], provenance_words: ['fixture placeholder'],
  contested_fields: [], refs: [], response_role: 'placeholder role', ...o,
});
export const paths = [
  row({ path_id: 'T01', sense_leaf: 'placeholder sense one', evidence_species: 'Arabidopsis thaliana', stimulus: 'fixture stimulus A', receptor: 'FX-R1 as written', cascade: 'fixture cascade A', signal_route: 'fixture route A', integration: 'Fixture integrator', response: 'fixture response A' }),
  row({ path_id: 'T02', sense_leaf: 'placeholder sense two', evidence_species: 'Lotus japonicus', also_in: ['Fixture branch two'], stimulus: 'fixture stimulus B', receptor: 'FX-R2 as written', cascade: null, signal_route: 'fixture route B', integration: '  fixture   INTEGRATOR ', response: 'fixture response B' }),
  row({ path_id: 'T03', sense_leaf: 'placeholder sense three', evidence_species: 'Arabidopsis thaliana and Medicago truncatula', stimulus: 'fixture stimulus C', receptor: 'text-only receptor C', cascade: 'fixture cascade C', signal_route: 'fixture route C', integration: 'fixture integrator C', response: 'fixture response C' }),
];
export const molecules = [
  { id: 'FX-R1', kind: 'protein', stage: 'receptor', paths: ['T01'], as_written: 'FX-R1 as written' },
  { id: 'FX-R2', kind: 'protein', stage: 'receptor', paths: ['T02'], as_written: 'FX-R2 as written' },
  // a cascade-stage record on T01: a chip on the card, never a node (app-methods §2.3)
  { id: 'FX-C1', kind: 'protein', stage: 'cascade', paths: ['T01'], as_written: 'fixture cascade A' },
];
/** hand-written expectation */
export const expected = {
  nodes: [
    'stimulus::fixture stimulus a', 'stimulus::fixture stimulus b', 'stimulus::fixture stimulus c',
    'mol::FX-R1', 'mol::FX-R2', 'receptor::text-only receptor c',
    'cascade::fixture cascade a', 'cascade::fixture cascade c',
    'signal_route::fixture route a', 'signal_route::fixture route b', 'signal_route::fixture route c',
    'integration::fixture integrator', 'integration::fixture integrator c',
    'response::fixture response a', 'response::fixture response b', 'response::fixture response c',
  ],
  edges: [
    'stimulus::fixture stimulus a->mol::FX-R1', 'mol::FX-R1->cascade::fixture cascade a', 'cascade::fixture cascade a->signal_route::fixture route a',
    'signal_route::fixture route a->integration::fixture integrator', 'integration::fixture integrator->response::fixture response a',
    'stimulus::fixture stimulus b->mol::FX-R2', 'mol::FX-R2->signal_route::fixture route b', 'signal_route::fixture route b->integration::fixture integrator',
    'integration::fixture integrator->response::fixture response b',
    'stimulus::fixture stimulus c->receptor::text-only receptor c', 'receptor::text-only receptor c->cascade::fixture cascade c', 'cascade::fixture cascade c->signal_route::fixture route c',
    'signal_route::fixture route c->integration::fixture integrator c', 'integration::fixture integrator c->response::fixture response c',
  ],
  dashed: { 'mol::FX-R2->signal_route::fixture route b': ['T02'] },
  shared: { 'integration::fixture integrator': ['T01', 'T02'] },
  species: { T01: 'Arabidopsis', T02: 'other species-only', T03: 'mixed' },
};
