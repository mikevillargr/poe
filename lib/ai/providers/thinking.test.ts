// DR-016: providers turn readable reasoning into `thinking` events, and only the streamed research / drafts ask for it.
// Run: npx tsx --conditions=react-server --test lib/ai/providers/thinking.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { BetaRawMessageStreamEvent } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { ResponseStreamEvent } from 'openai/resources/responses/responses'
import type { AIStreamEvent } from '../types'
import { AnthropicStreamMapper } from './anthropic-map'
import { OpenAIStreamMapper } from './openai-map'
import { ChatTurnAccumulator } from './moonshot-map'
import { createAnthropicProvider } from './anthropic'
import { fakeFetch, loadFixture, type SSEEvent } from './__fixtures__/fake-fetch'

test('anthropic: thinking_delta becomes a thinking event and stays out of the text', () => {
  const m = new AnthropicStreamMapper()
  const ev = { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'Check the fee first.', estimated_tokens: null } }
  assert.deepEqual(m.handle(ev as unknown as BetaRawMessageStreamEvent), [{ type: 'thinking', text: 'Check the fee first.' }])
  assert.equal(m.text, '')
})

test('openai: reasoning summary deltas become thinking events, paragraphs separated', () => {
  const m = new OpenAIStreamMapper()
  const part = m.handle({ type: 'response.reasoning_summary_part.added' } as unknown as ResponseStreamEvent)
  const delta = m.handle({ type: 'response.reasoning_summary_text.delta', delta: 'Looking for 2026 figures.' } as unknown as ResponseStreamEvent)
  assert.deepEqual(part, [{ type: 'thinking', text: '\n\n' }])
  assert.deepEqual(delta, [{ type: 'thinking', text: 'Looking for 2026 figures.' }])
  assert.equal(m.text, '')
})

test('moonshot: reasoning_content becomes thinking events and is still kept for the tool loop', () => {
  const m = new ChatTurnAccumulator()
  const out: AIStreamEvent[] = m.handle({ choices: [{ delta: { reasoning_content: 'Need the SOS fee table.' } }] } as never)
  assert.deepEqual(out, [{ type: 'thinking', text: 'Need the SOS fee table.' }])
  assert.equal(m.assistantMessage().reasoning_content, 'Need the SOS fee table.')
})

test('anthropic: adaptive summarized thinking only on streamed calls of modern models', async () => {
  const fx = loadFixture<{ final: SSEEvent[] }>('anthropic-research.json')
  const { fetch, requests } = fakeFetch({ '/v1/messages': [{ sse: fx.final }, { sse: fx.final }, { sse: fx.final }] })
  const p = createAnthropicProvider(async () => ({ apiKey: 'sk-ant-test-thinking-0123456789' }), { fetch })
  const prompt = { system: 'sys', messages: [{ role: 'user' as const, content: 'Title: x' }] }
  for await (const _ of p.streamText('claude-sonnet-5-5', prompt)) void _
  await p.generateText('claude-sonnet-5-5', prompt)
  for await (const _ of p.streamText('claude-haiku-4-5-20251001', prompt)) void _
  const [stream, background, haiku] = requests.map((r) => r.body as Record<string, unknown>)
  assert.deepEqual(stream.thinking, { type: 'adaptive', display: 'summarized' })
  assert.equal(background.thinking, undefined, 'background calls (optimize, extraction) do not think')
  assert.equal(haiku.thinking, undefined, 'older models are left alone')
})
