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

function mockArticle(prompt: string): string {
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
