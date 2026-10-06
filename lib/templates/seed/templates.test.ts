// Run: npx tsx --conditions=react-server --test lib/templates/seed/templates.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listPlaceholders } from '../placeholders'
import { templateConfigSchema, unresolvedPlaceholders } from '../schema'
import { CLIENT_GUIDELINE_SETS } from './guidelines'
import { CLIENT_TEMPLATE_SETS } from './templates'
import * as P from './prompts'

test('every seeded template passes the config schema, with every placeholder resolvable', () => {
  let n = 0
  for (const [client, set] of Object.entries(CLIENT_TEMPLATE_SETS)) {
    for (const t of set.templates) {
      const r = templateConfigSchema.safeParse(t.config)
      assert.ok(r.success, `${client}/${t.slug}: ${r.success ? '' : r.error.message}`)
      assert.deepEqual(unresolvedPlaceholders(t.config), [], `${client}/${t.slug}`)
      for (const v of Object.values(t.config.values)) {
        if (v.from === 'inventory') assert.ok(set.inventories.some((i) => i.slug === v.inventory), `${client}/${t.slug}: inventory ${v.inventory}`)
      }
      for (const h of t.config.hooks) {
        if (h.options?.inventory) assert.ok(set.inventories.some((i) => i.slug === h.options!.inventory), `${client}/${t.slug}: hook inventory`)
      }
      n++
    }
  }
  assert.equal(n, 10, 'ten n8n workflows')
})

test('template slugs line up with the guideline scopes', () => {
  for (const g of CLIENT_GUIDELINE_SETS) {
    const slugs = CLIENT_TEMPLATE_SETS[g.slug].templates.map((t) => t.slug).sort()
    assert.deepEqual(slugs, [...g.templates].sort(), g.slug)
  }
})

test('prompts are verbatim, unescaped, and SPP carries no LFP wording', () => {
  for (const [name, text] of Object.entries(P)) {
    assert.ok(!/\\[#_*.\-[\]]/.test(text), `${name} still has Markdown escapes`)
    assert.ok(!/ {2,}$/m.test(text), `${name} has trailing hard-break spaces`)
  }
  assert.doesNotMatch(P.SPP_WRITER_PROMPT + P.SPP_SELECTOR_PROMPT, /Ford|Levittown/)
  assert.match(P.SPP_WRITER_PROMPT, /Will this 2024 Subaru WRX Spoiler fit my Premium trim\?/)
  assert.deepEqual(listPlaceholders(P.NCH_WRITER_PROMPT).sort(), ['CURRENT_YEAR', 'PROMPT', 'SELECTED_URLS', 'SEO_KEYWORDS', 'TITLE', 'WORD_COUNT', 'YOUTUBE_URL'])
  assert.match(P.TWS_WRITER_PROMPT, /^1\. WORD COUNT: Stay strictly within \{\{WORD_COUNT\}\} words/m)
})
