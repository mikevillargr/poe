import 'server-only'
import type { AIProvider, AIStreamEvent, Citation, GenerateParams, ModelInfo, ProviderId } from '../types'

// Deterministic fake provider (AI_MOCK=1). Lets every workstream build and test streaming UIs and
// persistence without API keys. Output depends only on the prompt.

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

// Dev-only: AI_MOCK_DELAY_MS slows the mock (per chunk, and before the first search) so you can
// disconnect or stop mid-run.
const MOCK_DELAY_MS = () => Number(process.env.AI_MOCK_DELAY_MS) || 0

function lastUserText(p: GenerateParams) {
  return [...p.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
}

// WS optimize: deterministic stand-ins for the guideline check and recompose prompts, so the panel can
// be built and tested without keys. Quotes are real sentences taken from the draft in the prompt.
function mockOptimize(prompt: string): string {
  const draft = prompt.split('DRAFT:\n---\n')[1] ?? ''
  const sentences = draft
    .split(/\n+/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+/))
    .map((x) => x.trim())
    .filter((x) => x.split(/\s+/).length >= 8 && x.length < 180)
  const pick = [sentences[1], sentences[3], sentences[5]].filter(Boolean) as string[]
  const meta = [
    { category: 'Blacklist', severity: 'high', title: 'Reads as AI-written', reason: 'Sounds formulaic; rephrase plainly.' },
    { category: 'SEO', severity: 'medium', title: 'Work in a secondary keyword', reason: 'Secondary keywords should appear naturally.' },
    { category: 'Brand', severity: 'low', title: 'Tighten the wording', reason: 'Shorter sentences read better.' },
  ]
  return JSON.stringify({
    overallScore: 78,
    dimensionScores: [
      { category: 'SEO', score: 82, passCount: 4, failCount: 1 },
      { category: 'Blacklist', score: 70, passCount: 5, failCount: 2 },
      { category: 'Brand', score: 84, passCount: 3, failCount: 1 },
    ],
    suggestions: pick.map((original, i) => ({ ...meta[i], original, suggested: `${original.replace(/[.!?]+$/, '')}, said plainly.` })),
  })
}

// Ai-edit (inline) and revise stand-ins. Deterministic and derived from the prompt.
function mockRewrite(prompt: string): string {
  const sel = /<selection>\n([\s\S]*?)\n<\/selection>/.exec(prompt)?.[1] ?? 'Rewritten text'
  return `${sel} (mock rewrite)`
}

function mockRevision(prompt: string): string {
  const draft = /<draft>\n([\s\S]*?)\n<\/draft>/.exec(prompt)?.[1] ?? ''
  const feedback = /<feedback>\n([\s\S]*?)\n<\/feedback>/.exec(prompt)?.[1]?.trim() ?? ''
  return `${draft}\n<p>Mock revision applied: ${feedback.replace(/[<>]/g, '').slice(0, 120)}</p>`
}

// D-002 link selectors: pick real candidate URLs from the prompt (never the example.com samples).
function mockLinkSelection(prompt: string): string {
  const urls = [...new Set(prompt.match(/https?:\/\/[^\s,<>"')\]]+/g) ?? [])].filter((u) => !/example\.com/.test(u))
  if (prompt.includes('Select exactly ONE YouTube video URL')) return urls.find((u) => /youtu\.?be/.test(u)) ?? ''
  if (prompt.includes('PRODUCT_URLS:')) {
    const products = urls.filter((u) => /\/products?\//.test(u)).slice(0, 2)
    const articles = urls.filter((u) => !products.includes(u)).slice(0, 2)
    return `ARTICLE_URLS:\n${articles.join(', ')}\n\nPRODUCT_URLS:\n${products.join(', ')}`
  }
  return urls.slice(0, 3).join(', ')
}

function isLinkSelection(prompt: string) {
  return (
    prompt.includes('Extract only the URLs') ||
    prompt.includes('Select exactly ONE YouTube video URL') ||
    (prompt.includes('ARTICLE_URLS:') && prompt.includes('PRODUCT_URLS:') && prompt.includes('STRICT OUTPUT FORMAT'))
  )
}

// D-002 template writers: answer in the template's output shape (markers, FAQ headings, tribe page)
// so the parse → assemble → checks path runs end to end without keys.
const mockWords = (n: number, seed: string) =>
  Array.from({ length: Math.max(1, n) }, (_, i) => `${seed}${i % 7 === 6 ? '.' : ''}`).join(' ') + '.'

function mockTemplateWriter(prompt: string): string | null {
  const range = /(?:within|Word Count\*\*:)\s*(\d+)(?:\s*[–-]\s*(\d+))?\s*words/i.exec(prompt)
  const target = range ? Number(range[1]) : 1200
  const urls = [...new Set(prompt.match(/https?:\/\/[^\s,<>"')\]]+/g) ?? [])].filter((u) => !/example\.com/.test(u))
  const cta = urls.find((u) => /tenderbites\.ph$|pages\/contact|contact-nch|unitedtribes\.com\/community$/.test(u))
  const links = urls.filter((u) => u !== cta && !/youtube|youtu\.be|\/products\/tissot-le-locle|tommy-hilfiger-1792226/.test(u)).slice(0, 3)

  if (prompt.includes("Begin at '## Summary'")) {
    const qa = (n: number, w: number) => Array.from({ length: n }, (_, i) => `**Mock question ${i + 1}?**\n${mockWords(w, 'answer')}`).join('\n')
    const bullets = () => Array.from({ length: 3 }, () => `- ${mockWords(13, 'detail')}`).join('\n')
    return [
      '## Summary', mockWords(68, 'summary'), '',
      '## Community at a Glance',
      ...['Diaspora', 'Primary Language', 'Major Holiday/s', 'Cultural Religions', 'Religious Diversity', 'Civilization'].map((l) => `**${l}:** ${mockWords(9, 'fact')}`),
      '', '## Key Definitions', qa(3, 25), '',
      '## Cultural Heritage',
      ...['Cuisine', 'Arts & Music', 'Celebrations'].flatMap((h) => [`### ${h}`, mockWords(14, 'intro'), bullets()]),
      '', '## FAQ', qa(4, 22),
    ].join('\n')
  }

  const faq = /Generate a comprehensive (\d+)-question FAQ/.exec(prompt)
  if (faq) {
    const n = Number(faq[1])
    const h = prompt.includes('Questions MUST be H3') ? '###' : '##'
    const total = /Overall FAQ block:\s*(\d+)/.exec(prompt)
    const per = Math.round((total ? Number(total[1]) : 600) / n) - 10
    return Array.from({ length: n }, (_, i) => {
      const link = links[i] && i < 4 ? ` See [this page](${links[i]}).` : ''
      return `${h} Mock product question number ${i + 1} for this item?\n\n${mockWords(per, 'answer')}${link}`
    }).join('\n\n')
  }

  if (!prompt.includes('MAIN_CONTENT:') || !prompt.includes('CONCLUSION_HEADER')) return null
  const title = /Title\**:?\**:?\s*(.+?)\s*\(use exactly as provided/.exec(prompt)?.[1] ?? 'Mock article'
  const questions = prompt.includes('ALL H2s MUST BE PHRASED AS QUESTIONS')
  const per = Math.round(target / 7)
  const sections = Array.from({ length: 5 }, (_, i) => {
    const link = links[i] ? ` Read about [topic ${i + 1}](${links[i]}).` : ''
    return `## Mock section ${i + 1}${questions ? ' explained?' : ''}\n${mockWords(per, 'body')}${link}`
  })
  const out = [
    `ARTICLE_TITLE:\n${title}`,
    'META_TITLE:\nMock meta title',
    'META_DESCRIPTION:\nMock meta description for this article.',
  ]
  if (prompt.includes('TLDR_SUMMARY:')) out.push(`TLDR_SUMMARY:\n${mockWords(30, 'summary')}`)
  if (prompt.includes('KEY_TAKEAWAYS:')) out.push(`KEY_TAKEAWAYS:\n## Key Takeaways\n${Array.from({ length: 4 }, (_, i) => `- **Takeaway ${i + 1}** ${mockWords(12, 'point')}`).join('\n')}`)
  out.push(`MAIN_CONTENT:\n${mockWords(60, 'intro')}\n\n${sections.join('\n\n')}`)
  if (prompt.includes('VERDICT_SECTION:')) out.push(`VERDICT_SECTION:\n## Which option is best?\n${mockWords(80, 'verdict')}`)
  if (prompt.includes('FAQ_SECTION:')) {
    const n = /exactly 10 questions/i.test(prompt) ? 10 : 4
    const heading = prompt.includes('## Frequently Asked Questions') && !prompt.includes('EXPERT_TIPS_FROM_NCH') ? '## Frequently Asked Questions\n' : ''
    out.push(`FAQ_SECTION:\n${heading}${Array.from({ length: n }, (_, i) => `### Mock FAQ question ${i + 1}?\n${mockWords(45, 'answer')}`).join('\n\n')}`)
  }
  if (prompt.includes('EXPERT_TIPS_FROM_NCH:')) out.push(`EXPERT_TIPS_FROM_NCH:\n${Array.from({ length: 3 }, (_, i) => `${i + 1}. ${mockWords(15, 'tip')}`).join('\n')}`)
  out.push('CONCLUSION_HEADER:\nWhere To Go From Here')
  out.push(`CONCLUSION:\n${mockWords(70, 'closing')}\n\n${cta ? `[Visit us](${cta}) for more.` : mockWords(10, 'closing')}`)
  return out.join('\n')
}

function mockArticle(prompt: string): string {
  if (isLinkSelection(prompt)) return mockLinkSelection(prompt)
  const templated = mockTemplateWriter(prompt)
  if (templated !== null) return templated
  if (prompt.includes('Check this article draft against the guidelines')) return mockOptimize(prompt)
  if (prompt.includes('Reply with ONLY the rewritten passage')) {
    return `${/Current suggested replacement: "([^"]*)"/.exec(prompt)?.[1] ?? 'Rewritten passage'} (rewritten)`
  }
  if (prompt.includes('<feedback>') && prompt.includes('<draft>')) return mockRevision(prompt)
  if (prompt.includes('Return ONLY the replacement for the selection')) return mockRewrite(prompt)
  if (prompt.includes('Return ONLY the new content, as an HTML fragment')) {
    return '<p>Mock inserted paragraph that fits the surrounding context.</p><p>Mock second inserted paragraph.</p>'
  }
  const title = /title:\s*(.+)/i.exec(prompt)?.[1]?.trim() ?? 'Mock article'
  return [
    `<h1>${title}</h1>`,
    `<p>This is mock generated content for "${title}". It exists so the pipeline and editor can be built without a real model.</p>`,
    `<h2>Why it matters</h2>`,
    `<p>Mock paragraph one with a few sentences of placeholder copy. Mock paragraph text continues here.</p>`,
    `<h2>What to do next</h2>`,
    `<p>Mock paragraph two. Replace AI_MOCK=1 with a configured provider to get real output.</p>`,
  ].join('\n')
}

async function* chunked(text: string, signal?: AbortSignal): AsyncGenerator<AIStreamEvent> {
  for (const piece of text.match(/[\s\S]{1,24}/g) ?? []) {
    await sleep(15 + MOCK_DELAY_MS(), signal)
    yield { type: 'delta', text: piece }
  }
}

export function createMockProvider(id: ProviderId): AIProvider {
  const models: ModelInfo[] = [
    { provider: id, id: `mock-${id}`, label: `Mock (${id})`, supportsWebSearch: true, source: 'curated' },
  ]
  return {
    id,
    async listModels() {
      return models
    },
    async *streamText(_model, params) {
      const text = mockArticle(lastUserText(params))
      yield* chunked(text, params.signal)
      yield { type: 'usage', usage: { inputTokens: 100, outputTokens: text.length / 4 } }
      yield { type: 'done', text }
    },
    async generateText(_model, params) {
      return { text: mockArticle(lastUserText(params)), usage: { inputTokens: 100, outputTokens: 200 } }
    },
    async *research(_model, params) {
      const citations: Citation[] = [
        { id: '1', url: 'https://example.com/guide', title: 'Example guide', snippet: 'Mock snippet one.' },
        { id: '2', url: 'https://example.org/stats', title: 'Example statistics', snippet: 'Mock snippet two.' },
      ]
      await sleep(MOCK_DELAY_MS(), params.signal)
      yield { type: 'search', query: lastUserText(params).slice(0, 60) }
      await sleep(50, params.signal)
      for (const c of citations) yield { type: 'citation', citation: c }
      const text =
        '<h2>Summary</h2><p>Mock research summary [1][2].</p><h2>Outline</h2><ul><li>Intro</li><li>Section A</li><li>Section B</li><li>Conclusion</li></ul>'
      yield* chunked(text, params.signal)
      yield { type: 'done', text, citations }
    },
    async testKey() {
      return { ok: true, message: 'Mock provider' }
    },
  }
}
