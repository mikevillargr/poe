// Run: npx tsx --conditions=react-server --test lib/ai/providers/mock.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMockProvider } from './mock'

const mock = createMockProvider('anthropic')
const ask = async (prompt: string) => (await mock.generateText('mock', { messages: [{ role: 'user', content: prompt }] })).text

test('mock link selector returns candidate URLs, never the example.com samples', async () => {
  const urls = await ask(`PUBLISHED ARTICLES DATA:
Grill guide-https://tenderbites.ph/blogs/grill
Kasim-https://tenderbites.ph/blogs/kasim
IMPORTANT:
Extract only the URLs, not the titles
https://example.com/article-1, https://example.com/article-2`)
  assert.equal(urls, 'https://tenderbites.ph/blogs/grill, https://tenderbites.ph/blogs/kasim')
})

test('mock link selector: sectioned output and the YouTube pick', async () => {
  const sectioned = await ask(`AVAILABLE PRODUCT URLS:
https://thewatchstore.ph/products/tissot-prx
PUBLISHED ARTICLES DATA:
Guide-https://thewatchstore.ph/blogs/news/guide
STRICT OUTPUT FORMAT:
ARTICLE_URLS:
https://example.com/article-1
PRODUCT_URLS:
https://example.com/product-1`)
  assert.equal(sectioned, 'ARTICLE_URLS:\nhttps://thewatchstore.ph/blogs/news/guide\n\nPRODUCT_URLS:\nhttps://thewatchstore.ph/products/tissot-prx')
  const yt = await ask('YOUTUBE VIDEOS DATA:\nLLC basics-https://www.youtube.com/watch?v=abc\nSelect exactly ONE YouTube video URL most relevant to the current topic.')
  assert.equal(yt, 'https://www.youtube.com/watch?v=abc')
})
