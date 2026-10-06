import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarFormat, headerTsv, linkListFormat, sampleCsv, templateFormat } from './sheet-format'
import { autoMap, matchField, templateAliases } from './mapping'
import { parseSheet } from './parse'

const read = (csv: string) => parseSheet(Buffer.from(csv, 'utf8'), 'sample.csv').grid
import { buildInventoryItems, buildTemplateRows } from '@/lib/templates/rows'
import type { TemplateConfig } from '@/lib/templates/types'
import { tribePageRows } from '@/lib/templates/hooks/tribe-page'

test('calendar sample headers are recognised by the importer', () => {
  const f = calendarFormat()
  const grid = read(sampleCsv(f))
  assert.deepEqual(autoMap(grid[0]), { title: 0, brief: 1, keywords: 2, wordcount: 3 })
  for (const c of f.columns) for (const alias of c.alsoAccepted) assert.ok(matchField(alias), `alias "${alias}" should map`)
  assert.equal(grid.length, 3)
})

test('template format lists the template columns with its aliases', () => {
  const f = templateFormat({
    id: 't1',
    name: 'Product FAQ',
    kind: 'faq',
    inputs: [
      { key: 'title', label: 'Product name', required: true, aliases: ['Product Name'] },
      { key: 'itemUrl', label: 'Item URL', required: true, aliases: ['Item URL (B)'] },
      { key: 'keywords', label: 'SEO keywords', aliases: ['SEO Keywords', 'Keywords'] },
    ],
  })
  assert.deepEqual(f.columns.map((c) => c.header), ['Product name', 'Item URL', 'SEO keywords'])
  assert.deepEqual(f.columns.map((c) => c.required), [true, true, false])
  assert.ok(f.columns[1].alsoAccepted.includes('Item URL (B)'))
  // Every advertised name for a standard field really maps when this template is picked.
  const extra = templateAliases([{ key: 'title', label: 'Product name', aliases: ['Product Name'] }, { key: 'keywords', label: 'SEO keywords', aliases: ['SEO Keywords', 'Keywords'] }])
  for (const name of [f.columns[0].header, ...f.columns[0].alsoAccepted]) assert.equal(autoMap([name], extra).title, 0, name)
  for (const name of [f.columns[2].header, ...f.columns[2].alsoAccepted]) assert.equal(autoMap(['x', name], extra).keywords, 1, name)
  assert.ok(!f.columns[0].alsoAccepted.includes('Product name'), 'the header itself is not repeated')
  assert.equal(headerTsv(f), 'Product name\tItem URL\tSEO keywords')
})

test('link list sample is read back by the inventory importer', () => {
  const grid = read(sampleCsv(linkListFormat()))
  const items = buildInventoryItems(grid)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'How to Choose Your First Watch')
})

test('tribe-page sample has no header row and parses into pages', () => {
  const f = templateFormat({ id: 'p', name: 'Tribe page', kind: 'page', inputs: [] })
  assert.equal(f.headerRow, false)
  const rows = tribePageRows(read(sampleCsv(f)))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].keywords.length, 2)
})

test('CSV cells with commas or quotes are quoted', () => {
  const csv = sampleCsv(calendarFormat())
  assert.ok(csv.includes('"automatic watch, first watch, watch buying guide"'))
  assert.ok(csv.startsWith('﻿Title,Brief,Keywords,Word count\r\n'))
})

test('template sample is read by live sheet sync too', () => {
  const inputs = [
    { key: 'title', label: 'Product name', required: true, aliases: ['Product Name'] },
    { key: 'itemUrl', label: 'Item URL', required: true },
  ]
  const f = templateFormat({ id: 't', name: 'Product FAQ', kind: 'faq', inputs })
  const rows = buildTemplateRows(read(sampleCsv(f)), { inputs, assembly: 'faq' } as unknown as TemplateConfig)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].inputs.itemUrl, f.columns[1].examples[0])
})
