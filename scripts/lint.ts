/**
 * The app lints (safety.yaml → app_lints; SAFETY §4: case-insensitive whole-phrase lint). Shared by the content build,
 * the dist lint and the Playwright safety suite so all three judge text the same way.
 *
 * Whole-phrase: a phrase matches only between non-word characters, so "todo" never matches "ectodomain".
 *
 * MARKERS are the provenance markers the specs themselves require the app to render (ACTION-SPEC §6.1, KICKOFF §1:
 * "Gaps render as amber TODO(author) … and are listed on /methods"), plus perception-core 0.1.0's fixed heading for that
 * list. They are removed before the jargon lint runs, exactly like an allowed phrase. They are reported in the scrum
 * note for the curator to ratify as `allowed_phrases` in safety.yaml (the pack is never edited by the build).
 */
export type Lint = { id: string; phrases: string[]; allowed_phrases?: string[] };
export const MARKERS = ['TODO(author)', 'Open items (TODO)'];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const phraseRe = (ph: string) => new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(ph.toLowerCase())}(?=$|[^\\p{L}\\p{N}_])`, 'u');

export function lintHits(text: string, lints: Lint[]): { lint: string; phrase: string }[] {
  const hits: { lint: string; phrase: string }[] = [];
  for (const l of lints) {
    let low = text.toLowerCase();
    for (const ap of [...(l.allowed_phrases ?? []), ...MARKERS]) low = low.split(ap.toLowerCase()).join(' ');
    for (const ph of l.phrases) if (phraseRe(ph).test(low)) hits.push({ lint: l.id, phrase: ph });
  }
  return hits;
}
