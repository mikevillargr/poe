// Run: npx tsx --test lib/ai/models/models.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cachedModels, MODEL_CACHE_TTL_MS, modelCacheKey } from './cache'
import { curatedModels } from './curated'
import { baseModelId, isTextModel, mergeModels, supportsWebSearch } from './merge'

test('curated lists exist for every provider and are web-search annotated', () => {
  assert.deepEqual(
    curatedModels('anthropic').map((m) => m.id),
    ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-4-5-20251001'],
  )
  assert.deepEqual(
    curatedModels('openai').map((m) => m.id),
    ['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna', 'gpt-5.5', 'gpt-4.1', 'gpt-4.1-mini'],
  )
  assert.deepEqual(
    curatedModels('moonshot').map((m) => [m.id, m.supportsWebSearch]),
    [
      ['kimi-k3', true],
      ['kimi-k2.6', true],
      ['kimi-k2.7-code', false],
    ],
  )
  for (const m of curatedModels('openai')) assert.equal(m.source, 'curated')
})

test('snapshot IDs inherit curated capabilities', () => {
  assert.equal(baseModelId('claude-haiku-4-5-20251001'), 'claude-haiku-4-5')
  assert.equal(baseModelId('gpt-4.1-2025-04-14'), 'gpt-4.1')
  assert.equal(supportsWebSearch('anthropic', 'claude-haiku-4-5'), true)
  assert.equal(supportsWebSearch('openai', 'gpt-4.1-2025-04-14'), true)
  assert.equal(supportsWebSearch('openai', 'gpt-6-astra'), true)
  assert.equal(supportsWebSearch('openai', 'gpt-6-nova'), true, 'gpt-6 family rule')
  assert.equal(supportsWebSearch('openai', 'gpt-5.6-terra'), false, 'not documented → false')
  assert.equal(supportsWebSearch('moonshot', 'kimi-k2.7-code-highspeed'), false)
  assert.equal(supportsWebSearch('moonshot', 'kimi-k3'), true)
})

test('non-text models are filtered out of live lists', () => {
  for (const id of ['text-embedding-3-large', 'gpt-4o-mini-tts', 'gpt-realtime-2.1', 'gpt-image-2.5-flare', 'gpt-transcribe', 'whisper-1', 'gpt-live-1'])
    assert.equal(isTextModel('openai', id), false, id)
  for (const id of ['gpt-6-astra', 'gpt-4.1', 'o3', 'gpt-5.5-pro']) assert.equal(isTextModel('openai', id), true, id)
  assert.equal(isTextModel('moonshot', 'moonshot-v1-8k-vision-preview'), false)
  assert.equal(isTextModel('anthropic', 'claude-opus-5-5'), true)
})

test('merge: curated order first, live labels and context windows win, duplicates dropped', () => {
  const merged = mergeModels('anthropic', [
    { id: 'claude-opus-4-8', label: 'Claude Opus 4.8', contextWindow: 1_000_000 },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (live)', contextWindow: 999 },
    { id: 'claude-sonnet-5-5' },
    { id: 'claude-haiku-4-5' },
    { id: 'claude-haiku-4-5-20251001' },
  ])
  assert.deepEqual(
    merged.map((m) => [m.id, m.label, m.contextWindow]),
    [
      ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (live)', 999],
      ['claude-opus-4-8', 'Claude Opus 4.8', 1_000_000],
      // Haiku 4.5 is flagged deprecated (retiring), so its base and snapshot sort last.
      ['claude-haiku-4-5', 'Claude Haiku 4.5', 200000],
      ['claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 200000],
    ],
  )
  assert.ok(merged.every((m) => m.source === 'live' && m.provider === 'anthropic'))
})

test('model cache: 1h TTL, keyed by key fingerprint, failures not cached', async () => {
  const k1 = modelCacheKey('openai', 'sk-one')
  const k2 = modelCacheKey('openai', 'sk-two')
  assert.notEqual(k1, k2)
  assert.ok(!k1.includes('sk-one'))
  let calls = 0
  const load = async () => {
    calls++
    return curatedModels('openai')
  }
  const t0 = Date.now()
  await cachedModels(k1, load, t0)
  await cachedModels(k1, load, t0 + 1000)
  assert.equal(calls, 1)
  await cachedModels(k1, load, t0 + MODEL_CACHE_TTL_MS + 1)
  assert.equal(calls, 2)

  const k3 = modelCacheKey('moonshot', 'sk-three')
  await assert.rejects(cachedModels(k3, async () => Promise.reject(new Error('down'))))
  assert.equal((await cachedModels(k3, load)).length, 6, 'a failure is retried next time')
})
