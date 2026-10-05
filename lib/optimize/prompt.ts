// Prompts for the guideline check and for rewriting a single suggestion.
import type { GuidelineGroup } from '@/lib/pipeline/guidelines'

export interface OptimizePromptInput {
  title: string
  primaryKeyword: string | null
  keywords: string[]
  targetWordCount: number | null
  draftText: string
  guidelines: GuidelineGroup[]
}

export const OPTIMIZE_SYSTEM =
  'You are a meticulous SEO content editor. You check an article draft against a client\'s guidelines and return ONLY a JSON object. ' +
  'Never invent problems: every suggestion must quote text that appears verbatim in the draft.'

const MAX_DRAFT_CHARS = 60_000

export function buildOptimizePrompt(i: OptimizePromptInput): string {
  const rules = i.guidelines
    .map(
      (g) =>
        `## ${g.category.toUpperCase()}\n` +
        g.rules.map((r, n) => `${n + 1}. ${r.title ? `${r.title}: ` : ''}${r.rule} (weight ${r.weight}/10)`).join('\n'),
    )
    .join('\n\n')

  return `Check this article draft against the guidelines below.

Article title: ${i.title}
Primary keyword: ${i.primaryKeyword ?? '(none)'}
Other keywords: ${i.keywords.filter((k) => k !== i.primaryKeyword).join(', ') || '(none)'}
Target length: ${i.targetWordCount ? `${i.targetWordCount} words` : '(none)'}

GUIDELINES (grouped by category; the BLACKLIST category lists phrases and patterns that make writing sound machine-written, so flag every occurrence):
${rules || '(no guidelines configured)'}

For each guideline that the draft violates or could clearly improve on:
- quote the EXACT offending text from the draft (a sentence or phrase, copied character for character, no more than ~200 characters, within a single paragraph),
- give a replacement that fixes it and keeps the meaning, facts and links,
- name the guideline category, a severity (high = breaks a hard rule or blacklist, medium = clearly weaker, low = polish) and a one-line reason.
Return at most 25 suggestions, highest severity first. Do not suggest changes that merely restyle correct text.

Return ONLY this JSON (no prose, no code fences):
{
  "overallScore": 0-100,
  "dimensionScores": [{"category": "SEO", "score": 0-100, "passCount": 0, "failCount": 0}],
  "suggestions": [{"category": "SEO", "severity": "high|medium|low", "title": "short issue", "original": "exact text", "suggested": "replacement", "reason": "why"}]
}
Give one dimension score per guideline category above.

DRAFT:
---
${i.draftText.slice(0, MAX_DRAFT_CHARS)}
---`
}

export const TONALITIES: Record<string, string> = {
  professional: 'Rewrite this in a professional, authoritative tone suitable for business readers.',
  casual: 'Rewrite this in a casual, conversational tone.',
  concise: 'Rewrite this to be more concise and direct while keeping every fact.',
  detailed: 'Expand this with more concrete detail while keeping it readable.',
  persuasive: 'Rewrite this to be more persuasive, emphasising the benefit to the reader.',
  friendly: 'Rewrite this in a warm, friendly tone.',
}

export function buildRecomposePrompt(a: { originalText: string; currentSuggestion: string; instruction: string; guidelineHint?: string }): string {
  return `${a.instruction}

Original passage from the article: "${a.originalText}"
Current suggested replacement: "${a.currentSuggestion}"
${a.guidelineHint ? `\nKeep to these rules: ${a.guidelineHint}\n` : ''}
Reply with ONLY the rewritten passage as plain text: no quotes, no explanation, no markdown.`
}
