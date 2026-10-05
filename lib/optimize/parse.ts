// Parses and verifies the guideline-check model output (shared; pure).

export interface OptimizeSuggestion {
  id: string
  category: string
  severity: 'high' | 'medium' | 'low'
  title: string
  original: string
  suggested: string
  reason: string
  status: 'pending'
}

export interface DimensionScore {
  category: string
  score: number
  passCount: number
  failCount: number
}

export interface OptimizeOutput {
  overallScore: number
  dimensionScores: DimensionScore[]
  suggestions: OptimizeSuggestion[]
  /** Suggestions dropped because their quoted text isn't in the draft. */
  dropped: number
}

const clampScore = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)))
const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('The model did not return JSON.')
  return JSON.parse(body.slice(start, end + 1))
}

/**
 * `draftText` is the plain text of the draft: a suggestion is only kept when its `original` quote really
 * appears in it (the editor highlights and replaces by exact text, so an invented quote can't be applied).
 */
export function parseOptimizeOutput(raw: string, draftText: string): OptimizeOutput {
  const data = extractJson(raw) as Record<string, unknown>
  const haystack = norm(draftText)
  const seen = new Set<string>()
  let dropped = 0

  const suggestions: OptimizeSuggestion[] = []
  for (const s of Array.isArray(data.suggestions) ? (data.suggestions as Record<string, unknown>[]) : []) {
    const original = String(s.original ?? s.originalText ?? '').trim()
    const suggested = String(s.suggested ?? s.suggestedText ?? '').trim()
    if (!original || !suggested || original === suggested) {
      dropped++
      continue
    }
    const key = norm(original)
    if (!haystack.includes(key) || seen.has(key)) {
      dropped++
      continue
    }
    seen.add(key)
    const sev = String(s.severity ?? 'medium').toLowerCase()
    suggestions.push({
      id: `opt-${Date.now().toString(36)}-${suggestions.length}`,
      category: String(s.category ?? 'General').trim() || 'General',
      severity: sev === 'high' || sev === 'low' ? sev : 'medium',
      title: String(s.title ?? s.reason ?? 'Improve this passage').slice(0, 200),
      original,
      suggested,
      reason: String(s.reason ?? '').slice(0, 500),
      status: 'pending',
    })
  }

  const dimensionScores: DimensionScore[] = (Array.isArray(data.dimensionScores) ? (data.dimensionScores as Record<string, unknown>[]) : [])
    .map((d) => ({
      category: String(d.category ?? '').trim(),
      score: clampScore(d.score),
      passCount: Math.max(0, Math.round(Number(d.passCount) || 0)),
      failCount: Math.max(0, Math.round(Number(d.failCount) || 0)),
    }))
    .filter((d) => d.category)

  return { overallScore: clampScore(data.overallScore), dimensionScores, suggestions, dropped }
}
