import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderGuidelineTiers, TIER_HEADINGS, type GuidelineGroup } from './render'

const group = (tier: GuidelineGroup['tier'], category: string, rule: string): GuidelineGroup => ({
  tier,
  category,
  rules: [{ category, title: null, rule, weight: 5 }],
})
const plain = (g: GuidelineGroup) => `${g.category}: ${g.rules.map((r) => r.rule).join('; ')}`

test('agency-wide rules render first, then client rules, each under its heading', () => {
  const out = renderGuidelineTiers([group('client', 'structure', 'No H1'), group('universal', 'structure', 'Exactly one H1')], plain)
  assert.ok(out.indexOf(TIER_HEADINGS.universal) < out.indexOf('Exactly one H1'))
  assert.ok(out.indexOf('Exactly one H1') < out.indexOf(TIER_HEADINGS.client))
  assert.ok(out.indexOf(TIER_HEADINGS.client) < out.indexOf('No H1'))
  assert.match(TIER_HEADINGS.client, /client rule wins/)
})

test('a tier with no rules gets no heading', () => {
  const out = renderGuidelineTiers([group('universal', 'seo', 'Primary keyword in the H1')], plain)
  assert.ok(out.includes(TIER_HEADINGS.universal))
  assert.ok(!out.includes(TIER_HEADINGS.client))
  assert.equal(renderGuidelineTiers([], plain), '')
})

test('groups without a tier are treated as client rules', () => {
  const legacy = { category: 'seo', rules: [{ category: 'seo', title: null, rule: 'Old shape', weight: 5 }] } as unknown as GuidelineGroup
  assert.ok(renderGuidelineTiers([legacy], plain).startsWith(TIER_HEADINGS.client))
})
