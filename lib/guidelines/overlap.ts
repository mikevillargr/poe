// Likely-duplicate detection when imported rules are added beside a client's existing ones (D-002: the
// n8n doc's NCH rules go in next to NCH's 26 legacy rules). Word-overlap only, so it's a hint for a
// human: overlapping imports are saved inactive with a note, and nothing is ever deleted.

const STOPWORDS = new Set(
  'a an and are as at be but by for from has have in into is it its never no not of on or our that the their them they this to use was we when where which with without you your every each only always'.split(' '),
)

export function ruleTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9$%\s-]/g, ' ')
      .split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
      .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)), // crude plural stem
  )
}

function dice(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return (2 * shared) / (a.size + b.size)
}

export interface RuleLike {
  title?: string | null
  rule: string
}

/** 0–1: title similarity weighs 40%, rule text 60%. */
export function ruleSimilarity(a: RuleLike, b: RuleLike): number {
  const t = dice(ruleTokens(a.title ?? ''), ruleTokens(b.title ?? ''))
  const r = dice(ruleTokens(a.rule), ruleTokens(b.rule))
  return 0.4 * t + 0.6 * r
}

export const OVERLAP_THRESHOLD = 0.3

export interface OverlapMatch<T extends RuleLike> {
  existing: T
  score: number
}

/** The closest existing rule for `candidate`, or null when nothing reaches the threshold. */
export function closestOverlap<T extends RuleLike>(candidate: RuleLike, existing: T[], threshold = OVERLAP_THRESHOLD): OverlapMatch<T> | null {
  let best: OverlapMatch<T> | null = null
  for (const e of existing) {
    const score = ruleSimilarity(candidate, e)
    if (score >= threshold && (!best || score > best.score)) best = { existing: e, score }
  }
  return best
}
