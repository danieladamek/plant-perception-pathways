/**
 * Plant Perception Pathways' interface copy where it differs from perception-core 0.1.0's defaults: labels, search
 * hints and empty states only, never facts (ACTION-SPEC §5). The brand comes from the pack (ui-strings.yaml → brand).
 */
import strings from './data/strings.json';

export const HOST_STRINGS = {
  brand: strings.brand as [string, string],
  searchLabel: 'Search sense names, stage values, notes, molecules, gene names, AGI loci, UniProt and PDB ids, small molecules',
  searchPlaceholder: 'e.g. PD01, phyB, At5g63860, 4D9S, abscisic',
  legendEdgeColour: 'the same colour for every path',
  vocabPlaceholder: 'e.g. PYR1, SRK2E, stomatal closure',
  molMappingHover: 'Molecule node: a curator mapping of the receptor text to a molecule record (molecules.yaml).',
  textTransducer: 'Receptor text with no molecule record; shown as written.',
  contextNoteIntro: "The curator's framing note, rendered as supplied.",
  glossaryTodo: 'There is no glossary in pack 0.1.',
  conceptsTodo: 'There are no primer pages in pack 0.1.',
  sweep1: 'OpenAlex',
  sweepHandoff: 'handoff list',
};
