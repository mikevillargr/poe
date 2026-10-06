// Run: npx tsx --conditions=react-server --test lib/templates/seed/guidelines.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { closestOverlap, ruleSimilarity } from '@/lib/guidelines/overlap'
import { guidelineInputSchema } from '@/lib/guidelines/schemas'
import { CLIENT_GUIDELINE_SETS } from './guidelines'

test('every client set is valid: schema, unique titles per scope, known template slugs', () => {
  assert.deepEqual(
    CLIENT_GUIDELINE_SETS.map((c) => c.slug),
    ['levittown-ford-parts', 'subaru-parts-pros', 'tenderbites', 'the-watch-store-ph', 'united-tribes', 'nch'],
  )
  for (const set of CLIENT_GUIDELINE_SETS) {
    assert.ok(set.guidelines.length >= 10, `${set.slug} has rules`)
    const seen = new Set<string>()
    for (const g of set.guidelines) {
      const parsed = guidelineInputSchema.safeParse({ category: g.category, title: g.title, rule: g.rule, weight: g.weight, source: 'ingested' })
      assert.ok(parsed.success, `${set.slug} / ${g.title}: ${parsed.success ? '' : parsed.error.message}`)
      if (g.template) assert.ok(set.templates.includes(g.template), `${set.slug} / ${g.title}: unknown template ${g.template}`)
      const key = `${g.template ?? '*'}|${g.title.toLowerCase()}`
      assert.ok(!seen.has(key), `${set.slug}: duplicate title "${g.title}" in scope ${g.template ?? 'client'}`)
      seen.add(key)
    }
    for (const t of set.templates) {
      assert.ok(set.guidelines.some((g) => g.template === t), `${set.slug}: template ${t} has scoped rules`)
    }
  }
})

test('client-specific facts made it in', () => {
  const all = (slug: string) => CLIENT_GUIDELINE_SETS.find((c) => c.slug === slug)!.guidelines.map((g) => g.rule).join('\n')
  assert.match(all('subaru-parts-pros'), /Subaru/)
  assert.doesNotMatch(all('subaru-parts-pros'), /Ford|Levittown/, 'no leftover LFP wording in SPP')
  assert.match(all('tenderbites'), /P150 flat fee/)
  assert.match(all('the-watch-store-ph'), /Only Tissot, Alpina, Frederique Constant and Sandoz/)
  assert.match(all('nch'), /LegalZoom/)
  assert.match(all('nch'), /250,000\+/)
  assert.match(all('united-tribes'), /rich tapestry/)
})

test('overlap: near-duplicates score high, unrelated rules do not match', () => {
  const legacy = [
    { title: 'Avoid competitor mentions', rule: 'Do not mention competitors such as LegalZoom or ZenBusiness in any content.' },
    { title: 'Use H2 headings', rule: 'Break content into sections with H2 headings.' },
  ]
  const comp = { title: 'Competitors', rule: 'Never name a competitor: Anderson Business Advisors, ZenBusiness, LegalZoom, Bizee, or any other formation company.' }
  const m = closestOverlap(comp, legacy)
  assert.equal(m?.existing.title, 'Avoid competitor mentions')
  assert.equal(closestOverlap({ title: 'Statutes', rule: 'Cite NRS section numbers only when certain.' }, legacy), null)
  assert.ok(ruleSimilarity(legacy[0], legacy[0]) > 0.99)
})
