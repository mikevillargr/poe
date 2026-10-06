// Run: npx tsx --conditions=react-server --test lib/templates/diff.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedSettings, diffLines } from './diff'

test('line diff marks added and removed lines around unchanged ones', () => {
  const d = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne')
  assert.deepEqual(
    d.map((l) => `${l.type[0]}${l.text}`),
    ['sa', 'rb', 'aB', 'sc', 'sd', 'ae'],
  )
  assert.deepEqual(diffLines('same', 'same'), [{ type: 'same', text: 'same' }])
})

test('changed settings list paths, skipping prompt text', () => {
  const before = { writerPrompt: 'x', checks: { h2: { min: 4, max: 6 } }, enabled: true, selectors: [{ prompt: 'p', maxTokens: 300 }] }
  const after = { writerPrompt: 'y', checks: { h2: { min: 4, max: 8 } }, enabled: true, selectors: [{ prompt: 'q', maxTokens: 300 }] }
  assert.deepEqual(changedSettings(before, after), ['checks.h2.max: 6 → 8'])
})
