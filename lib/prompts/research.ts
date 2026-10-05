// Research prompt (WS pipeline). The research role's provider runs web search; this prompt tells the
// model what to look for and the exact output shape lib/pipeline/research.ts parses.
import type { ChatMessage } from '@/lib/ai/types'
import { fence, nf, orderedKeywords, wordBand, type PromptArticle } from './shared'

export interface BuiltPrompt {
  system: string
  messages: ChatMessage[]
  maxTokens?: number
  maxSearches?: number
}

const SYSTEM = `You are a senior SEO content researcher at a content agency. You research a topic on the live web before a writer drafts an article, and you hand the writer a short, cited research brief and an outline.

Rules:
- Use the web search tool. Search for the primary keyword, the main secondary keywords, and the questions searchers ask about the topic. Prefer primary sources, official bodies, and reputable publications. Prefer recent sources when the topic changes over time.
- Cite ONLY sources you actually opened or that the search tool returned. Never invent a source, URL, statistic, date, or quote. If you could not verify something, leave it out.
- Number sources [1], [2], … in the order you first cite them, and cite claims inline with those numbers, e.g. "Most states require an annual report [2]."
- Write plainly. No filler, no marketing language, no "in today's fast-paced world".

Output format. Return exactly these three sections and nothing else (no preamble, no markdown fences):

<summary>
2–5 short paragraphs of plain text: what top-ranking pages cover, what searchers need answered, key facts and figures with [n] citations, and gaps or angles the article can own.
</summary>
<outline>
The proposed article outline as HTML using only <h2> and <h3> elements, one heading per line. Cover the search intent for the primary keyword; work the secondary keywords into headings where they fit naturally. Do not include an <h1>.
</outline>
<sources>
One source per line: [n] Title — https://full.url
</sources>`

export function buildResearchPrompt(article: PromptArticle): BuiltPrompt {
  const { primary, secondary } = orderedKeywords(article)
  const band = wordBand(article.targetWordCount)
  const lines = [
    `Title: ${article.title}`,
    `Primary keyword: ${primary ?? '(none given; infer it from the title)'}`,
    `Secondary keywords: ${secondary.length ? secondary.join(', ') : '(none)'}`,
    `Target length of the final article: about ${nf.format(band.target)} words${band.defaulted ? ' (default; no target was set)' : ''}. Size the outline for that length.`,
  ]
  if (article.brief?.trim()) lines.push('', '<brief>', fence(article.brief.trim()), '</brief>')
  lines.push('', 'Research this article on the web, then return the <summary>, <outline> and <sources> sections.')

  return {
    system: SYSTEM,
    messages: [{ role: 'user', content: lines.join('\n') }],
    maxTokens: 4096,
    maxSearches: 6,
  }
}
