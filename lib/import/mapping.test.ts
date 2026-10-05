// Run: npx tsx --test lib/import/mapping.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoMap, buildRows, guessHeaderRow, matchField, parseWordCount } from './mapping'

test('matches common header variants', () => {
  assert.equal(matchField('Title'), 'title')
  assert.equal(matchField('Article Title'), 'title')
  assert.equal(matchField('Headline'), 'title')
  assert.equal(matchField('Brief'), 'brief')
  assert.equal(matchField('Description'), 'brief')
  assert.equal(matchField('Focus Keywords'), 'keywords')
  assert.equal(matchField('SEO keyword'), 'keywords')
  assert.equal(matchField('wordcount'), 'wordcount')
  assert.equal(matchField('Word Count'), 'wordcount')
  assert.equal(matchField('Target word count'), 'wordcount')
  assert.equal(matchField('Publish date'), null)
})

test('autoMap takes the first matching column per field', () => {
  assert.deepEqual(autoMap(['#', 'Title', 'Keywords', 'Brief', 'Words', 'Title (alt)']), {
    title: 1,
    keywords: 2,
    brief: 3,
    wordcount: 4,
  })
})

test('guesses the header row below a banner row', () => {
  const grid = [['NCH Q4 content calendar', '', ''], ['', '', ''], ['Title', 'Brief', 'Keywords'], ['A', 'b', 'c']]
  assert.equal(guessHeaderRow(grid), 2)
})

test('parses word counts', () => {
  assert.deepEqual(parseWordCount('1,500'), { value: 1500 })
  assert.deepEqual(parseWordCount('1500 words'), { value: 1500 })
  assert.deepEqual(parseWordCount('1.5k'), { value: 1500 })
  assert.deepEqual(parseWordCount('1200-1500'), { value: 1500 })
  assert.deepEqual(parseWordCount(''), { value: null })
  assert.equal(parseWordCount('long').error?.includes('isn’t a number'), true)
  assert.equal(parseWordCount('30').error?.includes('outside'), true)
})

test('builds rows with errors, blank-row skipping and duplicates', () => {
  const grid = [
    ['Title', 'Brief', 'Keywords', 'Word Count'],
    ['How to form an LLC', 'Guide', 'form an llc; nevada llc\nllc filing', '1,800'],
    ['', 'no title here', 'x', '900'],
    ['', '', '', ''],
    ['Registered agents', '', 'registered agent, Registered Agent', 'lots'],
    ['how to form an llc', '', '', ''],
    ['Existing article', '', '', '1000'],
  ]
  const rows = buildRows(grid, 0, autoMap(grid[0]), ['Existing Article'])
  assert.equal(rows.length, 5)
  assert.deepEqual(rows[0], {
    sheetRow: 2,
    title: 'How to form an LLC',
    brief: 'Guide',
    keywords: ['form an llc', 'nevada llc', 'llc filing'],
    targetWordCount: 1800,
    errors: [],
    duplicate: false,
  })
  assert.deepEqual(rows[1].errors, ['Missing title'])
  assert.deepEqual(rows[2].keywords, ['registered agent'])
  assert.equal(rows[2].errors.length, 1)
  assert.equal(rows[3].duplicate, true, 'duplicate within the sheet')
  assert.equal(rows[4].duplicate, true, 'duplicate of an existing article')
  assert.equal(rows[4].sheetRow, 7)
})
