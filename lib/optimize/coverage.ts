// Deterministic SEO checks on the draft HTML (shared client + server). No AI involved.

export interface KeywordCoverage {
  keyword: string
  isPrimary: boolean
  count: number
  /** Occurrences per 100 words (0 when the draft is empty). */
  density: number
  inH1: boolean
  inIntro: boolean // first 100 words
  inHeading: boolean // any H2/H3
  status: 'ok' | 'missing' | 'overused'
}

export interface LengthCheck {
  words: number
  target: number | null
  /** words / target, or null without a target. */
  ratio: number | null
  status: 'no-target' | 'short' | 'on-target' | 'long'
}

export interface CoverageReport {
  keywords: KeywordCoverage[]
  length: LengthCheck
  /** Keywords counted at least once / total (primary weighs double in `score`). */
  score: number
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function stripTags(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function headings(html: string, tags: string): string[] {
  const re = new RegExp(`<(${tags})[^>]*>([\\s\\S]*?)</\\1>`, 'gi')
  return [...html.matchAll(re)].map((m) => norm(stripTags(m[2])))
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = 0
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

export const DENSITY_WARN = 2 // % of words, per DR-005
export const LENGTH_BAND = 0.1 // ±10%

export function analyzeLength(words: number, target: number | null): LengthCheck {
  if (!target) return { words, target: null, ratio: null, status: 'no-target' }
  const ratio = words / target
  return {
    words,
    target,
    ratio,
    status: ratio < 1 - LENGTH_BAND ? 'short' : ratio > 1 + LENGTH_BAND ? 'long' : 'on-target',
  }
}

export function analyzeCoverage(
  html: string,
  keywords: string[],
  primaryKeyword: string | null,
  targetWordCount: number | null,
): CoverageReport {
  const text = norm(stripTags(html))
  const words = text ? text.split(' ').length : 0
  const intro = text.split(' ').slice(0, 100).join(' ')
  const h1 = headings(html, 'h1')
  const h23 = headings(html, 'h2|h3')

  const list = [...new Set([...(primaryKeyword ? [primaryKeyword] : []), ...keywords].map((k) => k.trim()).filter(Boolean))]
  const primary = primaryKeyword ? norm(primaryKeyword) : null

  const rows: KeywordCoverage[] = list.map((keyword) => {
    const k = norm(keyword)
    const count = countOccurrences(text, k)
    const density = words ? (count * k.split(' ').length * 100) / words : 0
    return {
      keyword,
      isPrimary: k === primary,
      count,
      density: Math.round(density * 100) / 100,
      inH1: h1.some((h) => h.includes(k)),
      inIntro: intro.includes(k),
      inHeading: h23.some((h) => h.includes(k)),
      status: count === 0 ? 'missing' : density > DENSITY_WARN ? 'overused' : 'ok',
    }
  })

  // Score: primary needs H1 + intro + a heading (3 checks, weight 2); each secondary just needs a mention.
  let got = 0
  let max = 0
  for (const r of rows) {
    if (r.isPrimary) {
      max += 6
      got += 2 * ((r.inH1 ? 1 : 0) + (r.inIntro ? 1 : 0) + (r.inHeading ? 1 : 0))
    } else {
      max += 1
      got += r.count > 0 ? 1 : 0
    }
  }
  return {
    keywords: rows,
    length: analyzeLength(words, targetWordCount),
    score: max ? Math.round((got / max) * 100) : 0,
  }
}
