// Run: npx tsx --conditions=react-server --test lib/templates/rows.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildInventoryItems, buildTemplateRows, resolveColumns } from './rows'
import { LFP_TEMPLATES, NCH_TEMPLATES, TWS_TEMPLATES, UT_TEMPLATES } from './seed/templates'

const cfg = (list: { slug: string; config: never }[] | unknown, slug: string) =>
  (list as { slug: string; config: Parameters<typeof buildTemplateRows>[1] }[]).find((t) => t.slug === slug)!.config

test('column specs: header names, loose match, letters, alternatives', () => {
  const headers = ['Live URLS', 'Page', 'Product URL', 'Slug']
  assert.deepEqual(resolveColumns('Live URLS|Live URLs', headers), [0])
  assert.deepEqual(resolveColumns('live urls', headers), [0])
  assert.deepEqual(resolveColumns('B', headers), [1])
  assert.deepEqual(resolveColumns('URL|url|Product URL|Slug', headers), [2, 3])
})

test('ideation rows (NCH): template aliases map Title/Prompt/SEO Keywords/Number of Words; blank titles skipped', () => {
  const grid = [
    ['Title', 'Prompt', 'SEO Keywords', 'Number of Words', 'Status'],
    ['How Much Does a Nevada LLC Cost?', 'Fee guide', 'nevada llc cost, nevada llc fees', '1800', 'Done'],
    ['', 'orphan brief', '', '', ''],
    ['Wyoming vs Nevada LLC', '', '', '=1500-2000', ''],
  ]
  const rows = buildTemplateRows(grid, cfg(NCH_TEMPLATES, 'blog'))
  assert.deepEqual(rows.map((r) => [r.sheetRow, r.title, r.brief, r.keywords, r.targetWordCount]), [
    [2, 'How Much Does a Nevada LLC Cost?', 'Fee guide', ['nevada llc cost', 'nevada llc fees'], 1800],
    [4, 'Wyoming vs Nevada LLC', null, [], 2000],
  ])
  assert.deepEqual(rows[1].inputs, { wordCount: '1500-2000' }, 'prompt keeps the sheet text')
})

test('product FAQ rows: header on row 2 (LFP), TWS item URL input, required input missing → error', () => {
  const lfp = buildTemplateRows([['Tracker'], ['URL', 'Product Name'], ['https://lfp.com/p/1', 'Ford F-150 Tonneau Cover']], cfg(LFP_TEMPLATES, 'product-faq'))
  assert.deepEqual(lfp.map((r) => [r.sheetRow, r.title]), [[3, 'Ford F-150 Tonneau Cover']])
  const tws = buildTemplateRows(
    [['Item', 'Item URL', 'Brand'], ['Tissot PRX', 'https://thewatchstore.ph/products/prx', 'Tissot'], ['Seiko 5', '', 'Seiko']],
    cfg(TWS_TEMPLATES, 'product-faq'),
  )
  assert.deepEqual(tws[0].inputs, { itemUrl: 'https://thewatchstore.ph/products/prx' })
  assert.deepEqual(tws[1].errors, ['Missing Item URL'])
})

test('tribe page rows use the community-page sheet layout', () => {
  const rows = buildTemplateRows(
    [['Page', 'Kw'], ['https://unitedtribes.com/community/filipino', 'Filipino community (2,400)', 'filipino food (900)']],
    cfg(UT_TEMPLATES, 'tribe-page'),
  )
  assert.deepEqual(rows[0], {
    sheetRow: 2,
    title: 'Filipino Community Page',
    brief: null,
    keywords: ['Filipino community', 'filipino food'],
    targetWordCount: null,
    inputs: { label: 'Filipino', pageUrl: 'https://unitedtribes.com/community/filipino' },
    errors: [],
  })
})

test('inventory items: auto URL/title columns, slugs + prefix, attrs, de-dupe, non-URLs skipped', () => {
  assert.deepEqual(
    buildInventoryItems([['TItle', 'Live URL', 'Notes'], ['LLC guide', 'https://nchinc.com/llc', 'x'], ['Draft', 'not live', ''], ['Dup', 'https://nchinc.com/llc/', '']]),
    [{ url: 'https://nchinc.com/llc', title: 'LLC guide', attrs: null }],
  )
  assert.deepEqual(
    buildInventoryItems([['URL'], ['tissot-prx-40'], ['/seiko-5']], { urlPrefix: 'https://thewatchstore.ph/products/' }).map((i) => i.url),
    ['https://thewatchstore.ph/products/tissot-prx-40', 'https://thewatchstore.ph/products/seiko-5'],
  )
  assert.deepEqual(
    buildInventoryItems([['City', 'Business Name', 'Business Page URL', 'heritage'], ['Dallas', 'Taqueria X', 'https://unitedtribes.com/b/x', 'Mexican']], {
      columnMap: { url: 'Business Page URL', title: 'Business Name', city: 'City', tribe: 'tribe|heritage|community' },
    }),
    [{ url: 'https://unitedtribes.com/b/x', title: 'Taqueria X', attrs: { city: 'Dallas', tribe: 'Mexican' } }],
  )
  // LFP product list: no URL header, header on row 2, columns by letter.
  assert.deepEqual(
    buildInventoryItems([['x'], ['A', 'Product Name'], ['https://lfp.com/p/1', 'Mats']], { columnMap: { url: 'A', title: 'B' }, headerRow: 2 }),
    [{ url: 'https://lfp.com/p/1', title: 'Mats', attrs: null }],
  )
  // URL column found from the data when no header names it.
  assert.equal(buildInventoryItems([['BLOG'], ['https://unitedtribes.com/pulse/a']]).length, 1)
})
