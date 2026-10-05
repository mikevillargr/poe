// Run: npx tsx --conditions=react-server --test lib/ai/providers/anthropic.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AIError, type AIStreamEvent } from '../types'
import { createAnthropicProvider } from './anthropic'
import { acceptsSampling, usesServerFallback, webSearchToolType } from './anthropic-map'
import { fakeFetch, loadFixture, type SSEEvent } from './__fixtures__/fake-fetch'

const fx = loadFixture<{
  pauseTurn: SSEEvent[]
  final: SSEEvent[]
  refusal: SSEEvent[]
  authError: unknown
  modelsPage: unknown
}>('anthropic-research.json')

let n = 0
const creds = () => {
  const apiKey = `sk-ant-test-${++n}-0123456789abcdef`
  return async () => ({ apiKey })
}

async function collect(it: AsyncIterable<AIStreamEvent>) {
  const out: AIStreamEvent[] = []
  for await (const ev of it) out.push(ev)
  return out
}

const prompt = { system: 'sys', messages: [{ role: 'user' as const, content: 'Title: Best CRM for startups' }] }

test('capability rules', () => {
  assert.equal(webSearchToolType('claude-opus-5-5'), 'web_search_20260209')
  assert.equal(webSearchToolType('claude-fable-5-1'), 'web_search_20260209')
  assert.equal(webSearchToolType('claude-sonnet-4-6'), 'web_search_20260209')
  assert.equal(webSearchToolType('claude-haiku-4-5-20251001'), 'web_search_20250305')
  assert.equal(webSearchToolType('claude-sonnet-4-5-20250929'), 'web_search_20250305')
  assert.equal(acceptsSampling('claude-opus-5-5'), false)
  assert.equal(acceptsSampling('claude-sonnet-5-5'), false)
  assert.equal(acceptsSampling('claude-fable-5-1'), false)
  assert.equal(acceptsSampling('claude-opus-4-7'), false)
  assert.equal(acceptsSampling('claude-haiku-4-5-20251001'), true)
  assert.equal(acceptsSampling('claude-opus-4-6'), true)
  assert.equal(usesServerFallback('claude-opus-5-5'), true)
  assert.equal(usesServerFallback('claude-haiku-4-5-20251001'), false)
})

test('research: search events, numbered de-duplicated citations, pause_turn resume, usage', async () => {
  const { fetch, requests } = fakeFetch({ '/v1/messages': [{ sse: fx.pauseTurn }, { sse: fx.final }] })
  const p = createAnthropicProvider(creds(), { fetch })
  const events = await collect(p.research('claude-opus-5-5', { ...prompt, maxTokens: 4096, temperature: 0.7, maxSearches: 6 }))

  assert.deepEqual(
    events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query),
    ['best crm for startups 2026', 'crm pricing startups'],
  )
  const cites = events.filter((e) => e.type === 'citation').map((e) => (e as Extract<AIStreamEvent, { type: 'citation' }>).citation)
  assert.deepEqual(cites, [
    { id: '1', url: 'https://www.example.com/crm-guide', title: 'CRM Guide 2026', snippet: 'Most startups weigh price before features.' },
    // title was null on the citation; filled from the earlier web_search_tool_result.
    { id: '2', url: 'https://stats.example.org/report', title: 'CRM Market Report', snippet: 'The SMB CRM market grew 14% in 2025.' },
  ])
  const usage = events.find((e) => e.type === 'usage') as Extract<AIStreamEvent, { type: 'usage' }>
  assert.deepEqual(usage.usage, { inputTokens: 1000 + 3000 + 500, outputTokens: 40 + 350 })
  const done = events.at(-1) as Extract<AIStreamEvent, { type: 'done' }>
  assert.equal(done.type, 'done')
  assert.deepEqual(done.citations, cites)
  assert.ok(done.text.startsWith('Researching. <summary>'))
  assert.ok(done.text.includes('<sources>\n[1] CRM Guide 2026'))
  const deltaText = events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text).join('')
  assert.equal(deltaText, done.text)

  // Request shape.
  assert.equal(requests.length, 2)
  const body = requests[0].body as Record<string, unknown>
  assert.equal(body.model, 'claude-opus-5-5')
  assert.equal(body.max_tokens, 16000, 'thinking models get a 16k floor')
  assert.equal(body.temperature, undefined, 'Opus 5.5 rejects temperature')
  assert.equal(body.system, 'sys')
  assert.equal(body.stream, true)
  assert.equal(body.fallbacks, 'default')
  assert.deepEqual(body.tools, [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }])
  assert.match(requests[0].headers['anthropic-beta'] ?? '', /server-side-fallback-2026-07-01/)
  assert.equal(requests[0].headers['x-api-key']?.startsWith('sk-ant-test-'), true)
  // The paused assistant turn is sent back unchanged, with no extra user message.
  const msgs = (requests[1].body as { messages: Array<{ role: string; content: unknown }> }).messages
  assert.deepEqual(
    msgs.map((m) => m.role),
    ['user', 'assistant'],
  )
  const resumed = msgs[1].content as Array<{ type: string }>
  assert.deepEqual(
    resumed.map((b) => b.type),
    ['thinking', 'text', 'server_tool_use', 'web_search_tool_result'],
  )
})

test('haiku: basic web search tool, temperature passed through, no fallbacks', async () => {
  const { fetch, requests } = fakeFetch({ '/v1/messages': [{ sse: fx.final }] })
  const p = createAnthropicProvider(creds(), { fetch })
  await collect(p.research('claude-haiku-4-5-20251001', { ...prompt, maxTokens: 4096, temperature: 0.4, maxSearches: 3 }))
  const body = requests[0].body as Record<string, unknown>
  assert.equal(body.max_tokens, 4096)
  assert.equal(body.temperature, 0.4)
  assert.equal(body.fallbacks, undefined)
  assert.deepEqual(body.tools, [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }])
})

test('streamText emits deltas, usage, done; generateText returns text + usage', async () => {
  const { fetch } = fakeFetch({ '/v1/messages': [{ sse: fx.final }, { sse: fx.final }] })
  const p = createAnthropicProvider(creds(), { fetch })
  const events = await collect(p.streamText('claude-sonnet-5-5', prompt))
  assert.deepEqual([...new Set(events.map((e) => e.type))], ['search', 'delta', 'citation', 'usage', 'done'])
  const g = await p.generateText('claude-sonnet-5-5', prompt)
  assert.ok(g.text.includes('<outline>'))
  assert.deepEqual(g.usage, { inputTokens: 3500, outputTokens: 350 })
})

test('a refusal becomes a PROVIDER_ERROR naming the category', async () => {
  const { fetch } = fakeFetch({ '/v1/messages': [{ sse: fx.refusal }] })
  const p = createAnthropicProvider(creds(), { fetch })
  await assert.rejects(collect(p.streamText('claude-opus-5-5', prompt)), (err: unknown) => {
    assert.ok(err instanceof AIError)
    assert.equal(err.code, 'PROVIDER_ERROR')
    assert.match(err.message, /cyber/)
    return true
  })
})

test('401 → INVALID_API_KEY, testKey reports it, and the key never appears', async () => {
  const { fetch } = fakeFetch({
    '/v1/messages': [{ status: 401, json: fx.authError }],
    '/v1/models': [{ status: 401, json: fx.authError }],
  })
  const loader = async () => ({ apiKey: 'sk-ant-secret-value-123456' })
  const p = createAnthropicProvider(loader, { fetch })
  await assert.rejects(collect(p.streamText('claude-opus-5-5', prompt)), (err: unknown) => {
    assert.ok(err instanceof AIError)
    assert.equal(err.code, 'INVALID_API_KEY')
    assert.ok(!err.message.includes('secret-value'))
    return true
  })
  const t = await p.testKey()
  assert.equal(t.ok, false)
  assert.match(t.message ?? '', /rejected the API key/)
})

test('an aborted signal surfaces as AbortError; non-search models are refused', async () => {
  const { fetch, requests } = fakeFetch({ '/v1/messages': [{ sse: fx.final }] })
  const p = createAnthropicProvider(creds(), { fetch })
  const ac = new AbortController()
  ac.abort()
  await assert.rejects(collect(p.streamText('claude-opus-5-5', { ...prompt, signal: ac.signal })), { name: 'AbortError' })
  await assert.rejects(collect(p.research('claude-2.1', prompt)), { code: 'WEB_SEARCH_UNSUPPORTED' })
  assert.equal(requests.length, 0)
})

test('listModels: live merged with curated, cached, curated fallback', async () => {
  const { fetch, requests } = fakeFetch({ '/v1/models': [{ json: fx.modelsPage }] })
  const p = createAnthropicProvider(creds(), { fetch })
  const models = await p.listModels()
  assert.deepEqual(
    models.map((m) => [m.id, m.source, m.supportsWebSearch]),
    [
      ['claude-fable-5-1', 'live', true],
      ['claude-opus-5-5', 'live', true],
      ['claude-sonnet-5-5', 'live', true],
      ['claude-opus-4-8', 'live', true],
      ['claude-haiku-4-5-20251001', 'live', true], // deprecated (retiring) → sorts last
    ],
  )
  assert.equal(models[4].contextWindow, 200000) // Haiku 4.5, sorted last as deprecated
  await p.listModels()
  assert.equal(requests.length, 1, 'second call served from the 1h cache')

  const failing = createAnthropicProvider(creds(), { fetch: fakeFetch({ '/v1/models': [{ status: 404, json: {} }] }).fetch })
  const curated = await failing.listModels()
  assert.deepEqual(
    curated.map((m) => m.source),
    ['curated', 'curated', 'curated', 'curated'],
  )

  const noKey = createAnthropicProvider(async () => {
    throw new AIError('PROVIDER_NOT_CONFIGURED', 'none')
  })
  assert.equal((await noKey.listModels()).length, 4)
  await assert.rejects(collect(noKey.streamText('claude-opus-5-5', prompt)), { code: 'PROVIDER_NOT_CONFIGURED' })
})
