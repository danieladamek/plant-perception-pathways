/**
 * The schema the pack is read with. The pack is written by Python (PyYAML, YAML 1.1), where a float needs a dot, so
 * an id such as `7E14` (a PDB entry) is written unquoted as text. The YAML 1.2 JSON/core schemas would read it as
 * 7 × 10¹⁴. This schema keeps null, booleans and integers as in the JSON schema, and reads a scalar as a float only
 * when it has a dot (or is .inf / .nan) — what the writer meant.
 */
import yaml from 'js-yaml';

const T = (yaml as any).types;
const float11 = new yaml.Type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: (s: string | null) => s !== null && /^(?:[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*(?:[eE][-+]?[0-9]+)?|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/.test(s) && s !== '.' && s !== '+.' && s !== '-.',
  construct: (s: string) => {
    const v = s.replace(/_/g, '').toLowerCase();
    if (v === '.nan') return NaN;
    if (v.endsWith('.inf')) return v.startsWith('-') ? -Infinity : Infinity;
    return parseFloat(v);
  },
  predicate: (o: unknown) => typeof o === 'number' && !Number.isInteger(o),
  represent: (o: unknown) => String(o),
  defaultStyle: 'lowercase',
});
export const PACK_SCHEMA = yaml.FAILSAFE_SCHEMA.extend({ implicit: [T.null, T.bool, T.int, float11] });
