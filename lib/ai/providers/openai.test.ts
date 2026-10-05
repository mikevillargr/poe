// Run: npx tsx --conditions=react-server --test lib/ai/providers/openai.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AIError, type AIStreamEvent } from '../types'
import { createOpenAIProvider } from './openai'
import { acceptsTemperature, isReasoningModel } from './openai-map'
import { fakeFetch, loadFixture, type SSEEvent } from './__fixtures__/fake-fetch'

const fx = loadFixture<{ stream: SSEEvent[]; failed: SSEEvent[]; rateLimitError: unknown; modelsPage: unknown }>('openai-research.json')

let n = 0
const creds = () => {
  const apiKey = `sk-proj-test-${++n}-abcdef0123456789`
  return async () => ({ apiKey })
}

async function collect(it: AsyncIterable<AIStreamEvent>) {
  const out: AIStreamEvent[] = []
  for await (const ev of it) out.push(ev)
  return out
}

const prompt = { system: 'sys', messages: [{ role: 'user' as const, content: 'Title: Best CRM for startups' }] }

test('parameter rules', () => {
  assert.equal(isReasoningModel('gpt-6.1-sol'), true)
  assert.equal(isReasoningModel('gpt-5.5'), true)
  assert.equal(isReasoningModel('o3'), true)
  assert.equal(isReasoningModel('gpt-4.1'), false)
  assert.equal(acceptsTemperature('gpt-4.1-mini'), true)
  assert.equal(acceptsTemperature('gpt-6-astra'), false)
})

test('research: url_citation annotations → numbered citations; queries → search events', async () => {
  const { fetch, requests } = fakeFetch({ '/responses': [{ sse: fx.stream }] })
  const p = createOpenAIProvider(creds(), { fetch })
  const events = await collect(p.research('gpt-6.1-sol', { ...prompt, maxTokens: 4096, temperature: 0.5, maxSearches: 6 }))

  assert.deepEqual(
    events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query),
    ['best crm for startups 2026', 'crm pricing startups'],
  )
  const done = events.at(-1) as Extract<AIStreamEvent, { type: 'done' }>
  assert.equal(done.type, 'done')
  assert.deepEqual(done.citations, [
    { id: '1', url: 'https://www.example.com/crm-guide', title: 'CRM Guide 2026' },
    { id: '2', url: 'https://stats.example.org/report', title: 'CRM Market Report' },
    // Present only in the final response.completed output, not streamed.
    { id: '3', url: 'https://third.example.net/pricing', title: 'Third Source' },
  ])
  assert.equal(events.filter((e) => e.type === 'citation').length, 3)
  assert.ok(done.text.startsWith('<summary>\nStartups pick'))
  const usage = events.find((e) => e.type === 'usage') as Extract<AIStreamEvent, { type: 'usage' }>
  assert.deepEqual(usage.usage, { inputTokens: 900, outputTokens: 420 })

  const body = requests[0].body as Record<string, unknown>
  assert.equal(new URL(requests[0].url).pathname, '/v1/responses')
  assert.equal(body.model, 'gpt-6.1-sol')
  assert.equal(body.instructions, 'sys')
  assert.deepEqual(body.input, prompt.messages)
  assert.deepEqual(body.tools, [{ type: 'web_search' }])
  assert.deepEqual(body.include, ['web_search_call.action.sources'])
  assert.equal(body.max_tool_calls, 6)
  assert.equal(body.max_output_tokens, 16000)
  assert.equal(body.temperature, undefined)
  assert.equal(body.stream, true)
  assert.equal(body.store, false)
})

test('gpt-4.1 keeps temperature and the requested token cap', async () => {
  const { fetch, requests } = fakeFetch({ '/responses': [{ sse: fx.stream }] })
  const p = createOpenAIProvider(creds(), { fetch })
  const g = await p.generateText('gpt-4.1', { ...prompt, maxTokens: 2000, temperature: 0.3 })
  const body = requests[0].body as Record<string, unknown>
  assert.equal(body.temperature, 0.3)
  assert.equal(body.max_output_tokens, 2000)
  assert.equal(body.tools, undefined)
  assert.deepEqual(g.usage, { inputTokens: 900, outputTokens: 420 })
})

test('response.failed and 429 map to AIError codes', async () => {
  const p = createOpenAIProvider(creds(), { fetch: fakeFetch({ '/responses': [{ sse: fx.failed }] }).fetch })
  await assert.rejects(collect(p.streamText('gpt-6-luna', prompt)), (err: unknown) => {
    assert.ok(err instanceof AIError)
    assert.equal(err.code, 'PROVIDER_ERROR')
    assert.match(err.message, /failed to respond/)
    return true
  })
  // retry-after-ms: 0 keeps the SDK's automatic 429 retries instant.
  const limited = { status: 429, json: fx.rateLimitError, headers: { 'retry-after-ms': '0' } }
  const q = createOpenAIProvider(creds(), { fetch: fakeFetch({ '/responses': [limited, limited, limited] }).fetch })
  await assert.rejects(collect(q.streamText('gpt-6-luna', prompt)), { code: 'RATE_LIMITED' })
})

test('research on a model without web search is refused before any request', async () => {
  const { fetch, requests } = fakeFetch({})
  const p = createOpenAIProvider(creds(), { fetch })
  await assert.rejects(collect(p.research('gpt-5.6-sol', prompt)), { code: 'WEB_SEARCH_UNSUPPORTED' })
  assert.equal(requests.length, 0)
})

test('listModels filters to text models, merges curated capabilities, marks deprecated', async () => {
  const { fetch } = fakeFetch({ '/models': [{ json: fx.modelsPage }] })
  const p = createOpenAIProvider(creds(), { fetch })
  const models = await p.listModels()
  assert.deepEqual(
    models.map((m) => [m.id, m.supportsWebSearch, !!m.deprecated]),
    [
      ['gpt-6-astra', true, false],
      ['gpt-6.1-sol', true, false],
      ['gpt-4.1-2025-04-14', true, false],
      ['gpt-5.6-sol', false, false],
      ['o4-mini', false, true],
    ],
  )
  assert.equal(models[0].label, 'GPT-6 Astra')
  assert.equal(models[0].contextWindow, 1050000)
})
