// Run: npx tsx --conditions=react-server --test lib/optimize/optimize.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeCoverage, analyzeLength } from './coverage'
import { extractJson, parseOptimizeOutput } from './parse'

const html = `<h1>How to Form an LLC in Wyoming: Costs</h1>
<p>Short answer: to form an LLC in Wyoming you file articles of organization and pay a $100 fee.</p>
<h2>Wyoming LLC cost breakdown</h2><p>${'word '.repeat(60)}wyoming registered agent</p>
<h2>Next steps</h2><p>Talk to us.</p>`

test('keyword coverage: placement, counts, status', () => {
  const r = analyzeCoverage(html, ['wyoming llc cost', 'wyoming registered agent', 'wyoming annual report'], 'form an llc in wyoming', 1500)
  const [primary, cost, agent, report] = r.keywords
  assert.equal(primary.isPrimary, true)
  assert.deepEqual([primary.inH1, primary.inIntro, primary.inHeading], [true, true, false])
  assert.equal(cost.inHeading, true)
  assert.equal(agent.count, 1)
  assert.equal(report.status, 'missing')
  assert.ok(r.score > 0 && r.score < 100)
})

test('overused keyword is flagged by density', () => {
  const stuffed = `<h1>x</h1><p>${'llc '.repeat(30)}</p>`
  assert.equal(analyzeCoverage(stuffed, [], 'llc', null).keywords[0].status, 'overused')
})

test('length check uses a ±10% band', () => {
  assert.equal(analyzeLength(1300, 1500).status, "short")
  assert.equal(analyzeLength(1450, 1500).status, 'on-target')
  assert.equal(analyzeLength(1700, 1500).status, 'long')
  assert.equal(analyzeLength(500, null).status, 'no-target')
})

test('extractJson handles fences and surrounding prose', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extractJson('Here you go: {"a":1} thanks'), { a: 1 })
  assert.throws(() => extractJson('no json here'))
})

test('parseOptimizeOutput keeps only quotes that are in the draft', () => {
  const draft = 'In today’s fast-paced world, you should leverage our robust service. We file your documents.'
  const out = parseOptimizeOutput(
    JSON.stringify({
      overallScore: 72.6,
      dimensionScores: [{ category: 'Blacklist', score: 40, passCount: 2, failCount: 3 }, { category: '', score: 1 }],
      suggestions: [
        { category: 'Blacklist', severity: 'HIGH', title: 'Stock opener', original: "In today's fast-paced world", suggested: 'Filing is slow.', reason: 'AI tell' },
        { category: 'Blacklist', severity: 'weird', original: 'leverage our robust service', suggested: 'use our service' },
        { category: 'SEO', original: 'text that is not in the draft', suggested: 'x' },
        { category: 'SEO', original: 'We file your documents.', suggested: 'We file your documents.' },
        { category: 'Blacklist', original: "in today's fast-paced world", suggested: 'dup' },
      ],
    }),
    draft,
  )
  assert.equal(out.overallScore, 73)
  assert.equal(out.dimensionScores.length, 1)
  assert.equal(out.suggestions.length, 2)
  assert.equal(out.suggestions[0].severity, 'high')
  assert.equal(out.suggestions[1].severity, 'medium')
  assert.equal(out.dropped, 3)
  assert.ok(out.suggestions.every((s) => s.id && s.status === 'pending'))
})
