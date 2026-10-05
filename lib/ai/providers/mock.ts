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

function lastUserText(p: GenerateParams) {
  return [...p.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
}

function mockArticle(prompt: string): string {
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
    await sleep(15, signal)
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
