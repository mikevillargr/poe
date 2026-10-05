// Run: npx tsx --conditions=react-server --test lib/pipeline/run-state.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatElapsed, isRunStale, statusAfterStop, STALE_RUN_MS } from './run-state'

const now = Date.UTC(2026, 9, 5, 12, 0, 0)
const ago = (ms: number) => new Date(now - ms)

test('only running rows can be stale', () => {
  for (const status of ['idle', 'ready', 'error'] as const) {
    assert.equal(isRunStale({ status, startedAt: ago(STALE_RUN_MS * 2), now, hasLiveRun: false }), false)
  }
})

test('a recent running row with a live run is not stale', () => {
  assert.equal(isRunStale({ status: 'running', startedAt: ago(60_000), now, hasLiveRun: true }), false)
})

test('a running row with no live run (restart/deploy) is stale immediately', () => {
  assert.equal(isRunStale({ status: 'running', startedAt: ago(1_000), now, hasLiveRun: false }), true)
})

test('a run past the timeout is stale even if a run is registered', () => {
  assert.equal(isRunStale({ status: 'running', startedAt: ago(STALE_RUN_MS + 1), now, hasLiveRun: true }), true)
  assert.equal(isRunStale({ status: 'running', startedAt: ago(STALE_RUN_MS - 1000), now, hasLiveRun: true }), false)
})

test('missing or invalid start time counts as stale', () => {
  assert.equal(isRunStale({ status: 'running', startedAt: null, now, hasLiveRun: true }), true)
  assert.equal(isRunStale({ status: 'running', startedAt: 'nope', now, hasLiveRun: true }), true)
})

test('stop resets to ready when a result exists, else idle', () => {
  assert.equal(statusAfterStop(true), 'ready')
  assert.equal(statusAfterStop(false), 'idle')
})

test('formatElapsed is mm:ss', () => {
  assert.equal(formatElapsed(0), '00:00')
  assert.equal(formatElapsed(65_900), '01:05')
  assert.equal(formatElapsed(-5), '00:00')
  assert.equal(formatElapsed(61 * 60_000), '61:00')
})
