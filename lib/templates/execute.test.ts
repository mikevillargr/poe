// Run: npx tsx --conditions=react-server --test lib/templates/execute.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AIStreamEvent } from '@/lib/ai/types'
import { executeTemplate, TemplateRunError, type ExecuteDeps } from './execute'
import { resolveFacts } from './facts'
import { TENDERBITES_TEMPLATES, TWS_TEMPLATES, UT_TEMPLATES } from './seed/templates'
import { formatInventory } from './values'

const facts = resolveFacts({})
const tbBlog = TENDERBITES_TEMPLATES.find((t) => t.slug === 'blog')!.config
const utBlog = UT_TEMPLATES.find((t) => t.slug === 'blog')!.config
const twsFaq = TWS_TEMPLATES.find((t) => t.slug === 'product-faq')!.config

function fakeDeps(opts: { select?: (p: string) => string; writes: string[]; page?: string }) {
  const events: AIStreamEvent[] = []
  const prompts: { select: string[]; write: string[] } = { select: [], write: [] }
  let w = 0
  const deps: ExecuteDeps = {
    previewEveryMs: 0,
    emit: (ev) => events.push(ev),
    async select(prompt) {
      prompts.select.push(prompt)
      return opts.select?.(prompt) ?? ''
    },
    async *write(prompt) {
      prompts.write.push(prompt)
      const text = opts.writes[Math.min(w++, opts.writes.length - 1)]
      for (const chunk of text.match(/[\s\S]{1,200}/g) ?? []) yield { type: 'delta', text: chunk }
      yield { type: 'done', text }
    },
    async fetchPage() {
      return opts.page ?? ''
    },
  }
  return { deps, events, prompts }
}

const para = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ')

function tbBlogResponse(links: string) {
  return `ARTICLE_TITLE:
How to Grill Ribeye
META_TITLE:
Grill Ribeye at Home
META_DESCRIPTION:
A practical guide to grilling ribeye.
MAIN_CONTENT:
${para(150)} ${links}

## Pick the Cut
${para(150)}

## Season It
${para(150)}

## Fire the Grill
${para(150)}

## Rest and Slice
${para(150)}
CONCLUSION_HEADER:
Ready for Your Next Handaan
CONCLUSION:
${para(60)}

${para(20)} [Visit TenderBites](https://tenderbites.ph)`
}

const article = (over: Partial<Parameters<typeof executeTemplate>[1]['article']> = {}) => ({
  title: 'How to Grill Ribeye',
  brief: 'Home grilling guide',
  primaryKeyword: null,
  keywords: [],
  targetWordCount: null,
  ...over,
})

test('TB blog: selector gets the inventory, invented URLs are dropped, writer sees the kept list, checks pass', async () => {
  const links = '[grilling](https://tenderbites.ph/blogs/grill) and [kasim](https://tenderbites.ph/blogs/kasim) and [steak](https://tenderbites.ph/blogs/steak)'
  const { deps, events, prompts } = fakeDeps({
    select: () => 'https://tenderbites.ph/blogs/grill, https://tenderbites.ph/blogs/kasim, https://tenderbites.ph/blogs/steak, https://invented.example/x',
    writes: [tbBlogResponse(links)],
  })
  const r = await executeTemplate(deps, {
    config: tbBlog,
    article: article(),
    inputs: {},
    inventories: {
      'blog-articles': ['grill', 'kasim', 'steak', 'pork'].map((s) => ({ url: `https://tenderbites.ph/blogs/${s}`, title: s, attrs: null })),
    },
    facts,
  })
  assert.match(prompts.select[0], /CURRENT BLOG TOPIC: How to Grill Ribeye/)
  assert.match(prompts.select[0], /https:\/\/tenderbites\.ph\/blogs\/pork/)
  assert.deepEqual(r.droppedLinks, ['https://invented.example/x'])
  assert.match(prompts.write[0], /Internal Links Data: https:\/\/tenderbites\.ph\/blogs\/grill, https:\/\/tenderbites\.ph\/blogs\/kasim, https:\/\/tenderbites\.ph\/blogs\/steak\n/)
  assert.equal(r.retried, false)
  assert.deepEqual(r.checks.filter((c) => !c.ok), [])
  assert.equal(r.needsReview, false)
  assert.match(r.html, /^<h1>How to Grill Ribeye<\/h1>/)
  assert.ok(events.some((e) => e.type === 'step' && e.step === 'selecting'))
  assert.ok(events.some((e) => e.type === 'reset') && events.some((e) => e.type === 'delta' && e.text.startsWith('<h1>')), 'rendered previews')
})

test('retry: a failing draft is rewritten once with the failures in the prompt; still failing → needs review, best kept', async () => {
  const bad = tbBlogResponse('').replace(/## Season It[\s\S]*?## Fire/, '## Fire') // 3 H2s, no links
  const { deps, events, prompts } = fakeDeps({ writes: [bad, bad] })
  const r = await executeTemplate(deps, { config: tbBlog, article: article(), inputs: {}, inventories: {}, facts })
  assert.equal(prompts.write.length, 2)
  assert.match(prompts.write[1], /failed these checks[\s\S]*3 H2 sections \(expected 4–6\)/)
  assert.ok(events.some((e) => e.type === 'step' && e.step === 'retrying'))
  assert.equal(r.retried, true)
  assert.equal(r.needsReview, true)
})

test('UT blog: tribe-filtered candidates, CTA style from ctaIndex, new tribe → no selector call and the no-links message', async () => {
  const blog = ['mexican-day-of-the-dead', 'filipino-noche-buena', 'business-directory'].map((s) => ({ url: `https://unitedtribes.com/pulse/${s}`, title: null, attrs: null }))
  const ok = fakeDeps({ select: () => 'https://unitedtribes.com/pulse/mexican-day-of-the-dead', writes: [tbBlogResponse('')] })
  const r = await executeTemplate(ok.deps, {
    config: utBlog,
    article: article({ title: 'Mexican Bakeries in Chicago', brief: 'pan dulce', keywords: ['mexican bakery'], targetWordCount: 1500 }),
    inputs: { ctaIndex: 7 },
    inventories: { 'blog-articles': blog },
    facts,
  })
  assert.match(ok.prompts.select[0], /PUBLISHED ARTICLES DATA:\nhttps:\/\/unitedtribes\.com\/pulse\/mexican-day-of-the-dead\n\nCONTEXT NOTE: These are dedicated/)
  assert.match(ok.prompts.write[0], /REQUIRED STYLE FOR THIS ARTICLE\*\*: QUESTION-LEAD/)
  assert.match(ok.prompts.write[0], /\*\*Word Count\*\*: 1500 words/)
  assert.equal(r.ctaStyle?.split(':')[0], 'QUESTION-LEAD')

  const none = fakeDeps({ writes: [tbBlogResponse('')] })
  await executeTemplate(none.deps, { config: utBlog, article: article({ title: 'Korean Barbecue Guide' }), inputs: {}, inventories: { 'blog-articles': blog }, facts })
  assert.equal(none.prompts.select.length, 0, 'no candidates → selector skipped')
  assert.match(none.prompts.write[0], /Internal Links Data\*\*: NO_INTERNAL_LINKS_AVAILABLE: This is a new "korean" tribe page/)
  assert.match(none.prompts.write[0], /\*\*Word Count\*\*: 1500-2500 words/, 'blank word count → template default')
})

test('TWS FAQ: product page text reaches the prompt; a missing description block fails the row', async () => {
  const page = '<div class="product__description rte quick-add-hidden"><p>Movement: Quartz</p><ul><li>5 ATM</li></ul></div>'
  const faq = Array.from({ length: 8 }, (_, i) => `## Question ${i + 1} about this Tissot PRX watch?\n\n${para(70)}`).join('\n\n')
  const { deps, prompts } = fakeDeps({ writes: [faq], page })
  const r = await executeTemplate(deps, {
    config: twsFaq,
    article: article({ title: 'Tissot PRX 40mm' }),
    inputs: { itemUrl: 'https://thewatchstore.ph/products/tissot-prx' },
    inventories: {},
    facts,
  })
  assert.match(prompts.write[0], /Product Details from Website: Movement: Quartz\n\n- 5 ATM/)
  assert.match(prompts.write[0], /Product URL: https:\/\/thewatchstore\.ph\/products\/tissot-prx/)
  assert.equal(r.checks.find((c) => c.id === 'question-count')?.ok, true)

  const empty = fakeDeps({ writes: [faq], page: '<div class="other"></div>' })
  await assert.rejects(
    executeTemplate(empty.deps, { config: twsFaq, article: article(), inputs: { itemUrl: 'https://thewatchstore.ph/products/x' }, inventories: {}, facts }),
    (e: unknown) => e instanceof TemplateRunError && e.code === 'PRODUCT_PAGE',
  )
  assert.equal(empty.prompts.write.length, 0, 'nothing generated from an empty page')
})

test('inventory formats skip rows missing a used field', () => {
  const rows = [
    { url: 'https://a.com/1', title: 'One', attrs: null },
    { url: 'https://a.com/2', title: null, attrs: null },
    { url: 'https://a.com/3', title: 'Three', attrs: { city: 'Dallas' } },
  ]
  assert.equal(formatInventory(rows, '{title}-{url}'), 'One-https://a.com/1\nThree-https://a.com/3')
  assert.equal(formatInventory(rows, '{url}'), 'https://a.com/1\nhttps://a.com/2\nhttps://a.com/3')
  assert.equal(formatInventory(rows, '{attr.city}: {url}'), 'Dallas: https://a.com/3')
})

test('LFP: "url-Title" candidate lines — candidates come from the inventory, echoed "url-Title" maps back', async () => {
  const { LFP_TEMPLATES } = await import('./seed/templates')
  const faq = Array.from({ length: 10 }, (_, i) => `## Question ${i + 1} about the Ford F-150 Tonneau Cover?\n\n${para(60)}`).join('\n\n')
  const { deps, prompts } = fakeDeps({
    select: () => 'ARTICLE_URLS:\nhttps://lfp.com/returns-Returns, https://lfp.com/shipping\n\nPRODUCT_URLS:\nhttps://lfp.com/p/mats-Floor Mats, https://lfp.com/p/rack',
    writes: [faq],
  })
  const r = await executeTemplate(deps, {
    config: LFP_TEMPLATES[0].config,
    article: article({ title: 'Ford F-150 Tonneau Cover' }),
    inputs: {},
    inventories: {
      'interlink-pages': [
        { url: 'https://lfp.com/returns', title: 'Returns', attrs: null },
        { url: 'https://lfp.com/shipping', title: 'Shipping', attrs: null },
      ],
      products: [
        { url: 'https://lfp.com/p/mats', title: 'Floor Mats', attrs: null },
        { url: 'https://lfp.com/p/rack', title: 'Rack', attrs: null },
      ],
    },
    facts,
  })
  assert.match(prompts.select[0], /https:\/\/lfp\.com\/returns-Returns\nhttps:\/\/lfp\.com\/shipping-Shipping/, 'n8n line format kept')
  assert.deepEqual(r.selectedLinks, ['https://lfp.com/returns', 'https://lfp.com/shipping', 'https://lfp.com/p/mats', 'https://lfp.com/p/rack'])
  assert.deepEqual(r.droppedLinks, [])
  assert.match(prompts.write[0], /Internal Links Data: ARTICLE_URLS:\nhttps:\/\/lfp\.com\/returns, https:\/\/lfp\.com\/shipping\n\nPRODUCT_URLS:\nhttps:\/\/lfp\.com\/p\/mats, https:\/\/lfp\.com\/p\/rack/)
})
