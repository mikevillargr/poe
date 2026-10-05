// Generation prompt (WS pipeline): brief + keywords + target length + client guidelines + the
// edited research brief → a full HTML article.
import type { GuidelineGroup } from '@/lib/pipeline/guidelines'
import type { WorkspaceResearch } from '@/lib/pipeline/schemas'
import { htmlToText } from '@/lib/articles/text'
import type { BuiltPrompt } from './research'
import { fence, nf, orderedKeywords, wordBand, type PromptArticle } from './shared'

const CATEGORY_LABELS: Record<string, string> = {
  seo: 'SEO',
  structure: 'Structure',
  readability: 'Readability',
  sourcing: 'Sourcing',
  brand: 'Brand voice',
  agency: 'Agency rules',
  client: 'Client rules',
  blacklist: 'Blacklist: words, phrases and patterns that make text sound AI-written. Never use them',
}

function guidelinesSection(groups: GuidelineGroup[]): string {
  if (!groups.length) return ''
  const parts = groups.map((g) => {
    const label = CATEGORY_LABELS[g.category] ?? g.category.charAt(0).toUpperCase() + g.category.slice(1)
    const rules = g.rules.map((r) => `- ${r.title ? `${r.title}: ` : ''}${r.rule.trim()}`).join('\n')
    return `### ${label}\n${rules}`
  })
  return `\n\n## Client guidelines (mandatory)\nThese come from the client and the agency. Follow every one. Where a guideline conflicts with the general rules above, the guideline wins, except that you must never invent facts.\n\n<guidelines>\n${fence(parts.join('\n\n'))}\n</guidelines>`
}

function systemPrompt(clientName: string, groups: GuidelineGroup[]): string {
  return `You are an expert SEO content writer at a content agency, writing for the client "${clientName}". You write complete, publish-ready articles that rank and read like a knowledgeable human wrote them.

## Output format
- Return ONLY the article as HTML. No preamble, no commentary, no markdown, no code fences.
- Allowed elements: <h1>, <h2>, <h3>, <p>, <ul>, <ol>, <li>, <a href="…">, <strong>, <em>. No other tags, no attributes except href, no inline styles.
- Exactly one <h1> (the article title) at the very start, then the body.

## SEO
- Put the primary keyword in the <h1>, within the first 100 words of the body, and in at least one <h2>.
- Use each secondary keyword naturally where it fits the content, at least once if it's relevant. Never force or repeat keywords to hit a count; no keyword stuffing. Keep the primary keyword under about 2% of words.
- Answer the main search intent directly near the top, then go deeper.

## Length
- Hit the target word count: stay within the stated range (±10%). Count only visible body text.

## Accuracy and sources
- Do not invent statistics, figures, dates, quotes, studies or sources. Use numbers only when they appear in the research sources provided; otherwise describe the point without a number.
- When research sources are provided, cite them as inline links on the relevant phrase: <a href="URL">descriptive anchor text</a>. Use only the URLs provided. No footnotes, no bracketed [n] markers, no "Sources" section.
- If no research is provided, rely on well-established knowledge, stay general where unsure, and do not add links.

## Structure and style
- Follow the provided outline when there is one: keep its order and headings (you may tighten wording), and fill each section with substance.
- Scannable <h2>/<h3> sections, short paragraphs (2–4 sentences), lists where they genuinely help.
- Plain, specific, confident language. No filler intros, no throat-clearing, no generic conclusions.${guidelinesSection(groups)}`
}

function researchSection(research: WorkspaceResearch): { text: string; sources: number } {
  const included = research.citations.filter((c) => !c.excluded)
  const parts: string[] = []
  if (research.summary?.trim()) parts.push('<summary>', fence(research.summary.trim()), '</summary>')
  if (research.outlineHtml?.trim()) {
    parts.push(
      '<outline>',
      'Follow this outline (edited by our team). Headings are given as HTML.',
      fence(research.outlineHtml.trim()),
      '</outline>',
    )
  }
  if (included.length) {
    parts.push(
      '<sources>',
      'The only sources you may link to. [n] markers in the summary refer to these numbers.',
      ...included.map((c) => `[${c.id}] ${c.title ? `${c.title} — ` : ''}${c.url}${c.snippet ? `\n    ${htmlToText(c.snippet).slice(0, 300)}` : ''}`),
      '</sources>',
    )
  }
  return { text: parts.join('\n'), sources: included.length }
}

export function buildGenerationPrompt(
  article: PromptArticle,
  opts: { clientName: string; guidelines: GuidelineGroup[]; research?: WorkspaceResearch | null },
): BuiltPrompt {
  const { primary, secondary } = orderedKeywords(article)
  const band = wordBand(article.targetWordCount)

  const lines = [
    `Title: ${article.title}`,
    `Primary keyword: ${primary ?? '(none given; use the core topic of the title)'}`,
    `Secondary keywords: ${secondary.length ? secondary.join(', ') : '(none)'}`,
    `Target word count: ${nf.format(band.target)} words (acceptable range ${nf.format(band.min)}–${nf.format(band.max)}).`,
  ]
  if (article.brief?.trim()) lines.push('', '<brief>', fence(article.brief.trim()), '</brief>')

  const research = opts.research ? researchSection(opts.research) : null
  if (research?.text) {
    lines.push('', '<research>', research.text, '</research>')
  } else {
    lines.push('', 'No research brief is available for this article. Do not include links or specific statistics.')
  }
  lines.push('', 'Write the complete article now, as HTML only.')

  // ~1.4 tokens per word of HTML output, plus headroom; providers cap this further.
  const maxTokens = Math.min(32000, Math.max(4096, Math.ceil(band.max * 2) + 1024))

  return {
    system: systemPrompt(opts.clientName, opts.guidelines),
    messages: [{ role: 'user', content: lines.join('\n') }],
    maxTokens,
  }
}
