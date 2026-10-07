import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AIStreamEvent } from '../types'
import { initialActivity, latestThought, reduceActivity, thoughtFor } from './activity'

const run = (events: AIStreamEvent[]) => events.reduce((s, ev, i) => reduceActivity(s, ev, 1000 + i * 1000), initialActivity())

test('research: thinking → searching → reading → writing, with a feed and timing', () => {
  const s = run([
    { type: 'thinking', text: 'What does a reader need? ' },
    { type: 'thinking', text: 'Check the fee first.' },
    { type: 'search', query: 'nevada annual list fee' },
    { type: 'citation', citation: { id: '1', url: 'https://www.nvsos.gov/fees', title: 'Fees' } },
    { type: 'citation', citation: { id: '2', url: 'https://example.com/a', title: 'A' } },
    { type: 'search', query: 'late penalty' },
    { type: 'delta', text: 'Summary text' },
  ])
  assert.equal(s.phase, 'writing')
  assert.equal(s.thinking, 'What does a reader need? Check the fee first.')
  assert.equal(thoughtFor(s), 1000)
  assert.deepEqual(
    s.feed.map((f) => [f.kind, f.text, f.urls?.length ?? 0]),
    [
      ['search', 'nevada annual list fee', 0],
      ['sources', 'nvsos.gov', 2],
      ['search', 'late penalty', 0],
    ],
  )
  assert.equal(s.sources, 2)
  assert.equal(s.searches, 2)
  assert.equal(s.textChars, 12)
})

test('template steps drive the phase; a retry reset clears the written count', () => {
  const s = run([
    { type: 'step', step: 'selecting', label: 'Picking internal links' },
    { type: 'step', step: 'writing', label: 'Writing the draft' },
    { type: 'delta', text: 'abc' },
    { type: 'step', step: 'checking', label: 'Running checks' },
    { type: 'reset', reason: 'meta too long' },
    { type: 'step', step: 'retrying', label: 'Rewriting: meta description too long' },
  ])
  assert.equal(s.phase, 'writing')
  assert.equal(s.textChars, 0)
  assert.deepEqual(s.feed.map((f) => f.text).slice(-1), ['Rewriting: meta description too long'])
})

test('thinking after writing starts does not move the phase back; no thinking → no duration', () => {
  const s = run([{ type: 'delta', text: 'x' }, { type: 'thinking', text: 'hmm' }])
  assert.equal(s.phase, 'writing')
  assert.equal(thoughtFor(run([{ type: 'delta', text: 'x' }])), null)
})

test('latestThought keeps the last sentence(s) within the limit', () => {
  assert.equal(latestThought('Short thought.'), 'Short thought.')
  const long = 'First sentence that is fairly long and goes on. '.repeat(6) + 'Final point about the late penalty.'
  const out = latestThought(long, 80)
  assert.ok(out.length <= 81, out)
  assert.ok(out.endsWith('late penalty.'))
})
