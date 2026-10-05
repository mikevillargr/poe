// Run: npx tsx --conditions=react-server --test lib/ai/providers/*.test.ts lib/ai/models/*.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AIError } from '../types'
import { CitationCollector, mapProviderError, normalizeUrl, parseNumberedSources, redactSecrets, stripTracking } from './shared'

test('citations are de-duplicated by normalised URL and numbered by first appearance', () => {
  const c = new CitationCollector()
  assert.equal(c.add({ url: 'https://Example.com/a/', title: 'A' })?.id, '1')
  assert.equal(c.add({ url: 'https://example.com/b', title: 'B' })?.id, '2')
  assert.equal(c.add({ url: 'https://example.com/a#frag' }), null)
  assert.equal(c.add({ url: 'https://example.com/a?utm_source=openai', snippet: 'later snippet' }), null)
  assert.equal(c.add({ url: 'not a url' }), null)
  assert.equal(c.add({ url: 'ftp://example.com/x' }), null)
  assert.equal(c.add({ url: 'https://example.com/c?id=1' })?.id, '3')
  assert.equal(c.add({ url: 'https://example.com/c?id=2' })?.id, '4')
  const list = c.list()
  assert.deepEqual(
    list.map((x) => x.id),
    ['1', '2', '3', '4'],
  )
  // A later mention fills a missing snippet but never renames or renumbers.
  assert.equal(list[0].title, 'A')
  assert.equal(list[0].snippet, 'later snippet')
})

test('tracking parameters are stripped from stored citation URLs', () => {
  assert.equal(stripTracking('https://x.com/p?utm_source=openai'), 'https://x.com/p')
  assert.equal(stripTracking('https://x.com/p?a=1&utm_medium=x'), 'https://x.com/p?a=1')
  assert.equal(stripTracking('https://x.com/p'), 'https://x.com/p')
  assert.equal(normalizeUrl('https://X.com/p/?utm_campaign=1#top'), 'https://x.com/p')
})

test('parses the numbered <sources> list the research prompt asks for', () => {
  const text = `<summary>Facts [1][2].</summary>
<outline><h2>A</h2></outline>
<sources>
[1] CRM Guide 2026 — https://www.example.com/crm-guide
[2] CRM Market Report – https://stats.example.org/report.
3. Plain numbered: https://plain.example.net/x
[4] [Markdown Title](https://md.example.com/page)
[5] Duplicate — https://www.example.com/crm-guide/
- [6] "Quoted" | https://quoted.example.com/q),
not a source line https://nope.example.com
</sources>`
  const got = parseNumberedSources(text)
  assert.deepEqual(got, [
    { id: '1', url: 'https://www.example.com/crm-guide', title: 'CRM Guide 2026' },
    { id: '2', url: 'https://stats.example.org/report', title: 'CRM Market Report' },
    { id: '3', url: 'https://plain.example.net/x', title: 'Plain numbered' },
    { id: '4', url: 'https://md.example.com/page', title: 'Markdown Title' },
    { id: '6', url: 'https://quoted.example.com/q', title: 'Quoted' },
  ])
})

test('falls back to a "Sources" heading when the tag is missing', () => {
  const got = parseNumberedSources('Body text.\n\n## Sources\n1. One — https://one.example.com\n2) Two https://two.example.com/x')
  assert.deepEqual(
    got.map((c) => [c.id, c.url]),
    [
      ['1', 'https://one.example.com'],
      ['2', 'https://two.example.com/x'],
    ],
  )
  assert.deepEqual(parseNumberedSources('No sources here [1].'), [])
})

test('maps HTTP status to AIError codes', () => {
  const e401 = mapProviderError('anthropic', { status: 401, message: 'invalid x-api-key' })
  assert.ok(e401 instanceof AIError)
  assert.equal((e401 as AIError).code, 'INVALID_API_KEY')
  assert.equal((mapProviderError('openai', { status: 403 }) as AIError).code, 'INVALID_API_KEY')
  assert.equal((mapProviderError('moonshot', { status: 429 }) as AIError).code, 'RATE_LIMITED')
  assert.equal((mapProviderError('openai', { status: 500 }) as AIError).code, 'PROVIDER_ERROR')
  assert.equal((mapProviderError('openai', new Error('socket hang up')) as AIError).code, 'PROVIDER_ERROR')
  const existing = new AIError('WEB_SEARCH_UNSUPPORTED', 'x')
  assert.equal(mapProviderError('openai', existing), existing)
})

test('abort-like errors become a DOMException AbortError', () => {
  const sdkAbort = Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' })
  const e = mapProviderError('anthropic', sdkAbort)
  assert.ok(e instanceof DOMException)
  assert.equal(e.name, 'AbortError')
  const ac = new AbortController()
  ac.abort()
  assert.equal(mapProviderError('openai', { status: 500 }, ac.signal).name, 'AbortError')
})

test('error messages never carry API keys', () => {
  const e = mapProviderError('openai', { status: 401, message: 'Incorrect API key provided: sk-proj-abcdef1234567890XYZ' })
  assert.ok(!e.message.includes('abcdef1234567890'))
  assert.equal(redactSecrets('Incorrect API key provided: sk-inval*********0000. You can'), 'Incorrect API key provided: sk-…. You can')
  assert.equal(redactSecrets('Authorization: Bearer abc.def-ghi_jkl12345'), 'Authorization: Bearer …')
})
