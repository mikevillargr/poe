// Run: npx tsx --conditions=react-server --test lib/guidelines/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupForPrompt, type PromptGuideline } from './prompt'

const g = (category: string, rule: string, weight = 5, title: string | null = null): PromptGuideline => ({
  category,
  title,
  rule,
  weight,
})

test('groups come out in canonical category order, blacklist last', () => {
  const groups = groupForPrompt([
    g('blacklist', 'b1'),
    g('client', 'c1'),
    g('seo', 's1'),
    g('brand', 'br1'),
    g('structure', 'st1'),
  ])
  assert.deepEqual(groups.map((x) => x.category), ['seo', 'structure', 'brand', 'client', 'blacklist'])
})

test('unknown categories rank just before the blacklist', () => {
  const groups = groupForPrompt([g('blacklist', 'b1'), g('legal', 'l1'), g('seo', 's1')])
  assert.deepEqual(groups.map((x) => x.category), ['seo', 'legal', 'blacklist'])
})

test('category keys are trimmed and lowercased', () => {
  const groups = groupForPrompt([g(' SEO ', 's1'), g('seo', 's2')])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].category, 'seo')
  assert.equal(groups[0].rules.length, 2)
})

test('rules are heaviest first within a group', () => {
  const groups = groupForPrompt([g('seo', 'light', 3), g('seo', 'heavy', 9), g('seo', 'mid', 5)])
  assert.deepEqual(groups[0].rules.map((r) => r.rule), ['heavy', 'mid', 'light'])
})

test('unknown categories sort alphabetically among themselves', () => {
  const groups = groupForPrompt([g('zebra', 'z1'), g('apple', 'a1'), g('blacklist', 'b1')])
  assert.deepEqual(groups.map((x) => x.category), ['apple', 'zebra', 'blacklist'])
})
