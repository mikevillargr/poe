// Prompt-building helpers shared by the research and generation prompts. Pure functions, no I/O.

export interface PromptArticle {
  title: string
  brief: string | null
  primaryKeyword: string | null
  keywords: string[]
  targetWordCount: number | null
}

export const DEFAULT_TARGET_WORDS = 1200

/** Primary keyword first, then the rest in their original order, de-duplicated case-insensitively. */
export function orderedKeywords(a: Pick<PromptArticle, 'primaryKeyword' | 'keywords'>): {
  primary: string | null
  secondary: string[]
} {
  const primary = a.primaryKeyword?.trim() || a.keywords[0]?.trim() || null
  const seen = new Set(primary ? [primary.toLowerCase()] : [])
  const secondary: string[] = []
  for (const k of a.keywords) {
    const t = k.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    secondary.push(t)
  }
  return { primary, secondary }
}

/** Target and the ±10% band the draft must land in. */
export function wordBand(target: number | null | undefined) {
  const t = target && target > 0 ? target : DEFAULT_TARGET_WORDS
  return { target: t, min: Math.round(t * 0.9), max: Math.round(t * 1.1), defaulted: !(target && target > 0) }
}

/** Keeps user-supplied text from closing our XML-ish prompt sections. */
export function fence(text: string): string {
  return text.replace(/<\/?(brief|research|summary|outline|sources|guidelines)>/gi, (m) => m.replace(/</g, '‹'))
}

export const nf = new Intl.NumberFormat('en-US')
