import { test } from 'node:test'
import assert from 'node:assert/strict'
import { median } from './estimates'

test('median: odd, even (rounded), empty', () => {
  assert.equal(median([30_000, 10_000, 20_000]), 20_000)
  assert.equal(median([1, 2, 3, 4]), 3)
  assert.equal(median([]), null)
})
