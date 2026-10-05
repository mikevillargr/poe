// Run: npx tsx --conditions=react-server --test lib/guidelines/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNIVERSAL_TEMPLATE } from './universal-template'
import { GUIDELINE_CATEGORIES } from './categories'

test('every rule has a valid category, weight 1–10 and a non-empty rule ≤ 2000 chars', () => {
  assert.ok(UNIVERSAL_TEMPLATE.length > 0)
  for (const g of UNIVERSAL_TEMPLATE) {
    assert.ok((GUIDELINE_CATEGORIES as readonly string[]).includes(g.category), `bad category: ${g.category}`)
    assert.ok(Number.isInteger(g.weight) && g.weight >= 1 && g.weight <= 10, `bad weight on "${g.title}"`)
    assert.ok(g.rule.trim().length > 0, `empty rule on "${g.title}"`)
    assert.ok(g.rule.length <= 2000, `rule too long on "${g.title}"`)
    assert.ok(g.title.trim().length > 0, 'empty title')
  }
})

test('titles are unique', () => {
  const titles = UNIVERSAL_TEMPLATE.map((g) => g.title.trim().toLowerCase())
  assert.equal(new Set(titles).size, titles.length)
})

test('brand rows are placeholders that ship inactive', () => {
  const brand = UNIVERSAL_TEMPLATE.filter((g) => g.category === 'brand')
  assert.ok(brand.length > 0)
  for (const g of brand) assert.equal(g.active, false, `brand rule "${g.title}" should ship inactive`)
})

test('the blacklist is substantial (at least 15 rules)', () => {
  const blacklist = UNIVERSAL_TEMPLATE.filter((g) => g.category === 'blacklist')
  assert.ok(blacklist.length >= 15, `only ${blacklist.length} blacklist rules`)
})
