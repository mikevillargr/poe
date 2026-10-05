// Guideline extraction from pasted/uploaded documents (DR-006 ingestion: extract → review →
// confirm, never auto-commit). Pure module — no server-only — so it stays unit-testable.
import { CATEGORY_LABELS, GUIDELINE_CATEGORIES } from './categories'
import { extractedRuleSchema, type ExtractedRule } from './schemas'

const CATEGORY_LIST = GUIDELINE_CATEGORIES.map((c) => `- "${c}" — ${CATEGORY_LABELS[c]}`).join('\n')

export function buildExtractMessages(sourceText: string): {
  system: string
  messages: { role: 'user'; content: string }[]
} {
  const system =
    'You extract content guidelines from style guides, briefs and editorial documents for a content agency. You return structured JSON and nothing else.'
  const content = `Read the document below and extract the content guidelines it states or clearly implies, as a JSON array.

Each element must be:
{ "category": one of the categories below, "title": a short label (string or null), "rule": the rule itself, "weight": an integer from 1 to 10 }

Categories (use only these):
${CATEGORY_LIST}

Extraction rules:
- Map the document's own language to the closest category above, even when the document uses different wording.
- Rewrite each rule as a short imperative statement. The rule text is injected verbatim into article-generation prompts, so it must read as an instruction to a writer.
- Set the weight by how strict the document is about the rule: explicit prohibitions and "must/never" rules are 8-10, strong preferences 5-7, soft suggestions 1-4.
- Extract at most 30 rules, the most important first.
- Return ONLY the JSON array. No prose, no markdown, no code fences.

<document>
${sourceText}
</document>`
  return { system, messages: [{ role: 'user', content }] }
}

// Finds the first top-level [...] span, honoring strings and escapes so ']' inside a rule's text
// doesn't end the array early. Returns null when there is no complete array.
function firstJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Parses the model's extraction response. Tolerates code fences and prose around the JSON array,
 * and silently drops elements that don't validate. Throws when nothing valid remains.
 */
export function parseExtractedRules(responseText: string): ExtractedRule[] {
  const fail = (why: string) => new Error(`No guidelines could be extracted from the model response (${why}).`)
  const text = responseText.replace(/```[a-z]*\s*/gi, '')
  const raw = firstJsonArray(text)
  if (!raw) throw fail('no JSON array found')

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw fail('malformed JSON')
  }
  if (!Array.isArray(parsed)) throw fail('not an array')

  const rules: ExtractedRule[] = []
  for (const el of parsed) {
    const res = extractedRuleSchema.safeParse(el)
    if (res.success) rules.push(res.data)
  }
  if (!rules.length) throw fail('no valid rules')
  return rules
}
