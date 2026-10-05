// Run: npx tsx --conditions=react-server --test lib/pipeline/runs.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drive, getRun, reserveRun } from './runs'
import type { AIStreamEvent } from '@/lib/ai/types'

async function collect(it: AsyncIterable<AIStreamEvent>) {
  const out: AIStreamEvent[] = []
  for await (const e of it) out.push(e)
  return out
}

test('a second reserve for the same article+kind conflicts; another kind is fine', () => {
  const a = reserveRun('research', 'art-1')
  assert.throws(() => reserveRun('research', 'art-1'), (e: { status?: number }) => e.status === 409)
  const b = reserveRun('generation', 'art-1')
  a.release()
  b.release()
  assert.equal(getRun('research', 'art-1'), undefined)
  reserveRun('research', 'art-1').release()
})

test('a run finishes and persists even when nobody is subscribed; late subscribers replay', async () => {
  const run = reserveRun('generation', 'art-2')
  let persisted = false
  async function* src(): AsyncGenerator<AIStreamEvent> {
    yield { type: 'delta', text: 'hi' }
    yield { type: 'done', text: 'hi' }
  }
  drive(run, src(), {
    onDone: async () => {
      persisted = true
      return [{ type: 'saved', articleId: 'art-2' }]
    },
    onPersistError: async () => {},
  })
  await run.waitDone(2000)
  assert.equal(persisted, true)
  assert.equal(getRun('generation', 'art-2'), undefined)
  const types = (await collect(run.subscribe())).map((e) => e.type)
  assert.deepEqual(types, ['delta', 'done', 'saved'])
})

test('a subscriber that detaches does not stop the run', async () => {
  const run = reserveRun('research', 'art-3')
  const ac = new AbortController()
  async function* src(): AsyncGenerator<AIStreamEvent> {
    await new Promise((r) => setTimeout(r, 50))
    yield { type: 'done', text: 'x' }
  }
  let persisted = false
  drive(run, src(), { onDone: async () => void (persisted = true), onPersistError: async () => {} })
  const sub = collect(run.subscribe(ac.signal))
  ac.abort()
  await sub
  await run.waitDone(2000)
  assert.equal(persisted, true)
})

test('a persistence failure calls onPersistError and emits an error event', async () => {
  const run = reserveRun('generation', 'art-4')
  let reset = false
  async function* src(): AsyncGenerator<AIStreamEvent> {
    yield { type: 'done', text: 'x' }
  }
  drive(run, src(), {
    onDone: async () => {
      throw new Error('boom')
    },
    onPersistError: async () => void (reset = true),
  })
  await run.waitDone(2000)
  assert.equal(reset, true)
  assert.ok((await collect(run.subscribe())).some((e) => e.type === 'error'))
})
