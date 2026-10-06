// Run: npx tsx --conditions=react-server --test lib/templates/hooks.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { containsWholeWord, detectAll, detectFirst } from './detect'
import { NO_DIRECTORY_LINKS, detectCity, planCityDirectory } from './hooks/city-directory'
import { extractDivByClass, productDetailsFromPage } from './hooks/product-page'
import { sliceByRowNumber, tribePageKeywords, tribePageRows } from './hooks/tribe-page'
import { UT_CTA_STYLES, UT_TRIBES, ctaStyleFor, planFifaLinks, planTribeLinks, selectedUrlsText } from './hooks/united-tribes'

test('whole-word matching: India ≠ Indiana, LA ≠ Atlanta, u.s. works', () => {
  assert.equal(containsWholeWord('indiana festivals', 'india'), false)
  assert.equal(containsWholeWord('best of india!', 'india'), true)
  assert.equal(containsWholeWord('atlanta watch party', 'l.a.'), false)
  assert.equal(containsWholeWord('the u.s. diaspora', 'u.s.'), true)
  assert.equal(containsWholeWord('/blog/mexican-food-guide', 'mexican'), true)
})

test('tribe detection: order wins, Mexican American → mexican, Persian → iranian, match-up → both', () => {
  assert.equal(detectFirst('a mexican american family tradition', UT_TRIBES)?.id, 'mexican')
  assert.equal(detectFirst('persian new year', UT_TRIBES)?.id, 'iranian')
  assert.equal(detectFirst('celebrating in indiana', UT_TRIBES), null)
  assert.deepEqual(detectAll('Mexico v Argentina in Dallas', UT_TRIBES).map((t) => t.id), ['mexican', 'argentine'])
})

const URLS = [
  'https://unitedtribes.com/pulse/mexican-day-of-the-dead',
  'https://unitedtribes.com/pulse/filipino-noche-buena',
  'https://unitedtribes.com/pulse/business-directory-guide',
]

test('UT link modes: tribe, all, general (Somali), none', () => {
  const tribe = planTribeLinks('Mexican bakeries - pan dulce', URLS)
  assert.equal(tribe.mode, 'tribe')
  assert.deepEqual(tribe.candidates, [URLS[0]])

  const all = planTribeLinks('Multicultural weddings', URLS)
  assert.equal(all.mode, 'all')
  assert.equal(all.candidates.length, 3)

  const general = planTribeLinks('Somali cuisine guide', URLS)
  assert.equal(general.mode, 'general')
  assert.deepEqual(general.candidates, [URLS[2]])
  assert.match(selectedUrlsText(general, URLS[2]), /^GENERAL_LINKS_ONLY \(not "somali"-specific/)
  assert.match(general.contextNote, /no dedicated articles/)

  const none = planTribeLinks('Korean barbecue in LA', URLS)
  assert.equal(none.mode, 'none')
  assert.equal(selectedUrlsText(none, ''), 'NO_INTERNAL_LINKS_AVAILABLE: This is a new "korean" tribe page with no published articles yet. Do not include any internal links in this blog.')

  assert.equal(planTribeLinks('Anything', []).mode, 'none', 'zero candidates → none')
})

test('FIFA links: every tribe in the match-up; no general fallback', () => {
  const urls = [...URLS, 'https://unitedtribes.com/pulse/argentina-asado']
  const p = planFifaLinks('Mexico vs Argentina: Dallas watch guide', urls)
  assert.equal(p.mode, 'tribe')
  assert.deepEqual(p.candidates, [URLS[0], urls[3]])
  assert.equal(planFifaLinks('Somalia fans in Seattle', URLS).mode, 'none')
})

test('CTA rotation cycles through the six styles', () => {
  assert.equal(ctaStyleFor(0), UT_CTA_STYLES[0])
  assert.equal(ctaStyleFor(5), UT_CTA_STYLES[5])
  assert.equal(ctaStyleFor(6), UT_CTA_STYLES[0])
  assert.equal(ctaStyleFor(-1), UT_CTA_STYLES[5])
})

test('host city: aliases, first match wins, bare "la" ignored', () => {
  assert.equal(detectCity('watch party in NYC')?.name, 'New York')
  assert.equal(detectCity('Bay Area fans')?.name, 'San Francisco')
  assert.equal(detectCity('la fiesta en Atlanta')?.name, 'Atlanta')
  assert.equal(detectCity('la fiesta'), null)
  const rows = [
    { city: 'Dallas, TX', url: 'https://unitedtribes.com/community/mexican/dallas', label: 'Mexican businesses in Dallas' },
    { city: 'Houston', tribe: 'Argentine', url: 'https://unitedtribes.com/community/argentine/houston' },
    { city: 'Miami', url: 'https://unitedtribes.com/community/brazilian/miami' },
  ]
  const plan = planCityDirectory('Mexico v Argentina in Dallas', rows)
  assert.equal(plan.city, 'Dallas')
  assert.deepEqual(plan.links.map((l) => l.url), [rows[0].url, rows[1].url])
  assert.equal(plan.text.split('\n')[0], `Mexican businesses in Dallas: ${rows[0].url}`)
  assert.equal(planCityDirectory('Japan in Seattle', rows).text, NO_DIRECTORY_LINKS)
})

test('product page: nested divs kept, html → text rules, missing/empty → null', () => {
  const page = `<div class="x"><div class="product__description rte quick-add-hidden">
    <p>Gender: Men&nbsp;</p><div class="inner"><ul><li>Case: 42mm</li><li>5 ATM &amp; sapphire</li></ul></div>
    <br>Warranty: 2 years</div><div>after</div></div>`
  assert.equal(productDetailsFromPage(page), 'Gender: Men\n\n- Case: 42mm\n- 5 ATM & sapphire\n\nWarranty: 2 years')
  assert.match(extractDivByClass(page, ['product__description']) ?? '', /class="inner"/)
  assert.equal(productDetailsFromPage('<div class="product__description rte quick-add-hidden">  </div>'), null)
  assert.equal(productDetailsFromPage('<div class="other">x</div>'), null)
})

test('tribe page rows: url detection, de-dupe, keywords, label, row slicing', () => {
  const grid = [
    ['Page', 'Keyword 1', 'Keyword 2'],
    ['https://unitedtribes.com/community/dominican-haitian', 'Dominican Haitian community (1,200)', 'haitian food (320)'],
    ['', 'https://unitedtribes.com/community/dominican-haitian'],
    ['https://unitedtribes.com/community/somali/', 'Culture Festivals (90)'],
    ['https://example.com/other', 'x (5)'],
  ]
  const rows = tribePageRows(grid)
  assert.deepEqual(rows.map((r) => [r.rowNumber, r.slug, r.label]), [
    [2, 'dominican-haitian', 'Dominican Haitian'],
    [4, 'somali', 'somali'],
  ])
  assert.equal(tribePageKeywords(rows[0].keywords), 'Dominican Haitian community, haitian food')
  assert.equal(tribePageKeywords([]), '(none)')
  assert.deepEqual(sliceByRowNumber(rows, 3, 2).map((r) => r.rowNumber), [4])
})
