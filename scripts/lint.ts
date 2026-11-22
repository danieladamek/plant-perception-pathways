/**
 * The app lints (safety.yaml → app_lints; SAFETY §4: case-insensitive whole-phrase lint). Shared by the content build,
 * the dist lint and the Playwright safety suite so all three judge text the same way.
 *
 * Whole-phrase: a phrase matches only between non-word characters, so "todo" never matches "ectodomain".
 *
 * Exemptions come only from safety.yaml (`allowed_phrases` per lint, pack 0.1.1); the code holds none of its own.
 */
export type Lint = { id: string; phrases: string[]; allowed_phrases?: string[] };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const phraseRe = (ph: string) => new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(ph.toLowerCase())}(?=$|[^\\p{L}\\p{N}_])`, 'u');

export function lintHits(text: string, lints: Lint[]): { lint: string; phrase: string }[] {
  const hits: { lint: string; phrase: string }[] = [];
  for (const l of lints) {
    let low = text.toLowerCase();
    for (const ap of l.allowed_phrases ?? []) low = low.split(ap.toLowerCase()).join(' ');
    for (const ph of l.phrases) if (phraseRe(ph).test(low)) hits.push({ lint: l.id, phrase: ph });
  }
  return hits;
}
