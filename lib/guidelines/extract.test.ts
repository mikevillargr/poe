// Run: npx tsx --conditions=react-server --test lib/guidelines/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildExtractMessages, parseExtractedRules } from './extract'

const RULES = JSON.stringify([
  { category: 'seo', title: 'Keyword in H1', rule: 'Use the primary keyword in the H1.', weight: 9 },
  { category: 'brand', title: null, rule: 'Address the reader as "you".', weight: 5 },
])

test('parses a clean JSON array', () => {
  const rules = parseExtractedRules(RULES)
  assert.equal(rules.length, 2)
  assert.equal(rules[0].category, 'seo')
  assert.equal(rules[1].title, null)
})

test('parses a ```json fenced response', () => {
  const rules = parseExtractedRules(`\`\`\`json\n${RULES}\n\`\`\``)
  assert.equal(rules.length, 2)
})

test('tolerates prose before and after the array', () => {
  const rules = parseExtractedRules(`Here are the guidelines I found:\n\n${RULES}\n\nLet me know if you'd like more detail.`)
  assert.equal(rules.length, 2)
})

test('drops invalid elements but keeps valid ones', () => {
  const mixed = JSON.stringify([
    { category: 'seo', title: 'OK', rule: 'Use the primary keyword in the H1.', weight: 9 },
    { category: 'tone', title: 'Bad category', rule: 'Be nice.', weight: 5 },
    { category: 'brand', title: 'No rule' },
    { category: 'blacklist', rule: 'Never use "delve".' }, // weight defaults to 5
  ])
  const rules = parseExtractedRules(mixed)
  assert.equal(rules.length, 2)
  assert.equal(rules[0].category, 'seo')
  assert.equal(rules[1].category, 'blacklist')
  assert.equal(rules[1].weight, 5)
})

test('handles ] inside string values', () => {
  const rules = parseExtractedRules(JSON.stringify([{ category: 'seo', rule: 'Use [primary keyword] in the H1.' }]))
  assert.equal(rules.length, 1)
  assert.ok(rules[0].rule.includes('[primary keyword]'))
})

test('throws when there is no JSON array', () => {
  assert.throws(() => parseExtractedRules('Sorry, I could not find any guidelines.'), /No guidelines could be extracted/)
})

test('throws when nothing valid remains', () => {
  assert.throws(() => parseExtractedRules('[{"category":"nope","rule":"x"},{"foo":1}]'), /No guidelines could be extracted/)
})

test('buildExtractMessages constrains categories and demands JSON only', () => {
  const { system, messages } = buildExtractMessages('A'.repeat(60))
  assert.equal(messages.length, 1)
  assert.equal(messages[0].role, 'user')
  assert.ok(system.length > 0)
  for (const c of ['seo', 'structure', 'readability', 'sourcing', 'brand', 'agency', 'client', 'blacklist']) {
    assert.ok(messages[0].content.includes(`"${c}"`), `missing category ${c}`)
  }
  assert.ok(messages[0].content.includes('Return ONLY the JSON array'))
  assert.ok(messages[0].content.includes('A'.repeat(60)))
})
