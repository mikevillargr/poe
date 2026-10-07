// Run: npx tsx --conditions=react-server --test lib/ai/providers/moonshot.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AIStreamEvent } from '../types'
import { createMoonshotProvider } from './moonshot'
import { ChatTurnAccumulator, moonshotCitations } from './moonshot-map'
import { fakeFetch, loadFixture, type SSEEvent } from './__fixtures__/fake-fetch'

const fx = loadFixture<{
  builtinToolTurn: SSEEvent[]
  answerTurn: SSEEvent[]
  restToolTurn: SSEEvent[]
  searchResponse: unknown
  modelsPage: unknown
}>('moonshot-research.json')

let n = 0
const creds = () => {
  const apiKey = `sk-moon-test-${++n}-abcdef0123456789`
  return async () => ({ apiKey, baseUrl: 'https://api.moonshot.ai/v1' })
}

async function collect(it: AsyncIterable<AIStreamEvent>) {
  const out: AIStreamEvent[] = []
  for await (const ev of it) out.push(ev)
  return out
}

const prompt = { system: 'sys', messages: [{ role: 'user' as const, content: 'Title: Best CRM for startups' }] }
type Msg = { role: string; content?: string; name?: string; tool_call_id?: string; reasoning_content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }

test('accumulator joins split tool-call deltas and keeps reasoning_content', () => {
  const acc = new ChatTurnAccumulator()
  for (const e of fx.builtinToolTurn) acc.handle(e.data as never)
  assert.equal(acc.finishReason, 'tool_calls')
  assert.deepEqual(acc.toolCalls(), [
    { id: 'call_ws_1', name: '$web_search', arguments: '{"search_result":{"search_id":"s-123"},"usage":{"total_tokens":5120}}' },
  ])
  assert.deepEqual(acc.usage, { inputTokens: 400, outputTokens: 30 })
  assert.equal(acc.assistantMessage().reasoning_content, 'I should search for current CRM pricing.')
})

test('builtin $web_search loop: echoes arguments, parses numbered sources into citations', async () => {
  const { fetch, requests } = fakeFetch({
    '/chat/completions': [
      { sse: fx.builtinToolTurn, done: true },
      { sse: fx.answerTurn, done: true },
    ],
  })
  const p = createMoonshotProvider(creds(), { fetch, searchMode: 'builtin' })
  const events = await collect(p.research('kimi-k3', { ...prompt, maxTokens: 4096, temperature: 0.7, maxSearches: 6 }))

  const done = events.at(-1) as Extract<AIStreamEvent, { type: 'done' }>
  assert.equal(done.type, 'done')
  assert.deepEqual(done.citations, [
    { id: '1', url: 'https://www.example.com/crm-guide', title: 'CRM Guide 2026' },
    { id: '2', url: 'https://stats.example.org/report', title: 'CRM Market Report' },
  ])
  assert.equal(events.filter((e) => e.type === 'citation').length, 2)
  assert.ok(done.text.startsWith('<summary>\nStartups pick'))
  const usage = events.find((e) => e.type === 'usage') as Extract<AIStreamEvent, { type: 'usage' }>
  assert.deepEqual(usage.usage, { inputTokens: 6400, outputTokens: 330 })

  assert.equal(requests.length, 2)
  const first = requests[0].body as Record<string, unknown>
  assert.equal(new URL(requests[0].url).pathname, '/v1/chat/completions')
  assert.deepEqual(first.tools, [{ type: 'builtin_function', function: { name: '$web_search' } }])
  assert.equal(first.temperature, undefined, 'Kimi models reject custom temperature')
  assert.equal(first.max_completion_tokens, 16000)
  assert.deepEqual(first.stream_options, { include_usage: true })
  const second = (requests[1].body as { messages: Msg[] }).messages
  assert.deepEqual(
    second.map((m) => m.role),
    ['system', 'user', 'assistant', 'tool'],
  )
  assert.equal(second[2].reasoning_content, 'I should search for current CRM pricing.')
  assert.equal(second[2].tool_calls?.[0].function.name, '$web_search')
  assert.deepEqual(
    { id: second[3].tool_call_id, name: second[3].name, content: JSON.parse(second[3].content ?? '') },
    { id: 'call_ws_1', name: '$web_search', content: { search_result: { search_id: 's-123' }, usage: { total_tokens: 5120 } } },
  )
})

test('rest mode: runs POST /tools/search, emits the query, enriches citations', async () => {
  const { fetch, requests } = fakeFetch({
    '/chat/completions': [
      { sse: fx.restToolTurn, done: true },
      { sse: fx.answerTurn, done: true },
    ],
    '/tools/search': [{ json: fx.searchResponse }],
  })
  const p = createMoonshotProvider(creds(), { fetch, searchMode: 'rest' })
  const events = await collect(p.research('kimi-k2.6', { ...prompt, maxSearches: 3 }))
  assert.deepEqual(
    events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query),
    ['best crm for startups 2026'],
  )
  const done = events.at(-1) as Extract<AIStreamEvent, { type: 'done' }>
  assert.equal(done.citations?.[0].snippet, 'Most startups weigh price before features.')
  assert.equal(done.citations?.length, 2)

  const search = requests.find((r) => r.url.endsWith('/tools/search'))!
  assert.equal(search.method, 'POST')
  assert.equal(search.headers.authorization?.startsWith('Bearer sk-moon-test-'), true)
  assert.deepEqual(search.body, { text_query: 'best crm for startups 2026', limit: 8, timeout_seconds: 30 })
  const chat2 = (requests.at(-1)!.body as { messages: Msg[]; tools: Array<{ type: string; function: { name: string } }> })
  assert.equal(chat2.tools[0].type, 'function')
  assert.equal(chat2.tools[0].function.name, 'web_search')
  const toolMsg = chat2.messages.at(-1)!
  assert.equal(toolMsg.role, 'tool')
  assert.equal(JSON.parse(toolMsg.content ?? '[]')[0].url, 'https://www.example.com/crm-guide')
})

test('citation fallback and capability checks', async () => {
  assert.deepEqual(moonshotCitations('no list here', [{ url: 'https://a.example.com', title: 'A', snippet: 's' }]), [
    { id: '1', url: 'https://a.example.com', title: 'A', snippet: 's' },
  ])
  const { fetch, requests } = fakeFetch({})
  const p = createMoonshotProvider(creds(), { fetch })
  await assert.rejects(collect(p.research('kimi-k2.7-code', prompt)), { code: 'WEB_SEARCH_UNSUPPORTED' })
  assert.equal(requests.length, 0)
})

test('streamText and listModels', async () => {
  const { fetch } = fakeFetch({
    '/chat/completions': [{ sse: fx.answerTurn, done: true }],
    '/models': [{ json: fx.modelsPage }],
  })
  const p = createMoonshotProvider(creds(), { fetch })
  const events = await collect(p.streamText('kimi-k3', prompt))
  assert.deepEqual([...new Set(events.map((e) => e.type))], ['thinking', 'delta', 'usage', 'done'])
  const models = await p.listModels()
  assert.deepEqual(
    models.map((m) => [m.id, m.supportsWebSearch, !!m.deprecated, m.contextWindow]),
    [
      ['kimi-k3', true, false, 1000000],
      ['kimi-k2.6', true, false, 262144],
      ['kimi-k2.7-code', false, false, 262144],
      ['moonshot-v1-8k', false, true, undefined],
    ],
  )
})
