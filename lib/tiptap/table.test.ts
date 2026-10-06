// Run: npx tsx --conditions=react-server --test lib/tiptap/table.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'

// TipTap parses HTML with the DOM; give it one.
const dom = new JSDOM('<!doctype html><html><body></body></html>')
Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser, Node: dom.window.Node })

const draft = `<h2>How Much Does a Nevada LLC Cost?</h2><p>It costs $425.</p>
<table><thead><tr><th>Fee</th><th>Nevada</th><th>Wyoming</th></tr></thead>
<tbody><tr><td>Filing</td><td>$425</td><td>$100</td></tr><tr><td>Annual</td><td><strong>$350</strong></td><td>$60</td></tr></tbody></table>`

test('drafts keep their tables through the editor schema (and lost them before)', async () => {
  const { generateHTML, generateJSON } = await import('@tiptap/core')
  const { default: StarterKit } = await import('@tiptap/starter-kit')
  const { tableExtensions } = await import('./table')

  const before = generateHTML(generateJSON(draft, [StarterKit]), [StarterKit])
  assert.doesNotMatch(before, /<table/, 'StarterKit alone drops the table')

  const exts = [StarterKit, ...tableExtensions]
  const after = generateHTML(generateJSON(draft, exts), exts)
  assert.match(after, /<table/)
  assert.equal((after.match(/<th\b/g) ?? []).length, 3)
  assert.equal((after.match(/<td\b/g) ?? []).length, 6)
  assert.match(after, /<td[^>]*><p><strong>\$350<\/strong><\/p><\/td>/)
  assert.match(after, /It costs \$425\./)
})
