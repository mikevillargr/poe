// Run: npx tsx --conditions=react-server --test lib/pipeline/research.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeCitations, parseResearchOutput } from './research'

const text = `<summary>Nevada has no state income tax [2]. Filing fees are low [1].</summary>
<outline><h2>Fees</h2><h2>Taxes</h2></outline>
<sources>
[1] Nevada SOS fees — https://www.nvsos.gov/fees
[2] Tax Foundation — https://taxfoundation.org/nevada
</sources>`

test('model source-list numbering wins; provider data enriches by URL', () => {
  // Provider returned them in a different order (first structured citation first).
  const provider = [
    { id: '1', url: 'https://taxfoundation.org/nevada/', title: 'Nevada taxes', snippet: 'No personal income tax.' },
    { id: '2', url: 'https://www.nvsos.gov/fees', snippet: 'LLC filing fee $75.' },
  ]
  const r = parseResearchOutput(text, provider, ['nevada llc'])
  assert.deepEqual(
    r.citations.map((c) => [c.id, c.url]),
    [
      ['1', 'https://www.nvsos.gov/fees'],
      ['2', 'https://taxfoundation.org/nevada'],
    ],
  )
  assert.equal(r.citations[0].snippet, 'LLC filing fee $75.')
  assert.equal(r.citations[1].title, 'Tax Foundation')
  assert.equal(r.citations[1].snippet, 'No personal income tax.')
})

test('falls back to provider citations when the model wrote no source list', () => {
  const provider = [{ id: '1', url: 'https://example.com/a', title: 'A' }]
  assert.deepEqual(mergeCitations([], provider), provider)
  const r = parseResearchOutput('<summary>x [1]</summary><outline><h2>A</h2></outline>', provider, [])
  assert.equal(r.citations[0].url, 'https://example.com/a')
})
