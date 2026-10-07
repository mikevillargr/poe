import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { draftHash, exportFilename, headers, toCsv, toXlsx, type ExportRow } from './table'

const row: ExportRow = {
  title: 'Seiko 5, the "everyday" watch',
  status: 'In Review',
  primaryKeyword: 'seiko 5',
  keywords: ['seiko 5', 'automatic watch'],
  words: 1210,
  targetWords: 1200,
  score: 88,
  owner: 'Ana Cruz',
  poeLink: 'https://poe.vill.ar/s/abc',
  docLink: 'https://docs.google.com/document/d/x/edit',
  openComments: 2,
  decision: 'Approved by Ben',
  updatedAt: '2026-10-07T10:00:00.000Z',
}

test('columns follow what was chosen', () => {
  assert.ok(headers({ poeLinks: true, docs: false }).includes('Poe preview link'))
  assert.ok(!headers({ poeLinks: true, docs: false }).includes('Google Doc'))
  assert.deepEqual(headers({ poeLinks: false, docs: true }).slice(-4), ['Google Doc', 'Open comments', 'Client decision', 'Last updated'])
})

test('CSV quotes commas and quotes, and defuses formula-looking cells', () => {
  const csv = toCsv([{ ...row, owner: '=HYPERLINK("x")' }], { poeLinks: true, docs: true })
  const line = csv.split('\r\n')[1]!
  assert.ok(line.startsWith('"Seiko 5, the ""everyday"" watch",In Review,seiko 5,"seiko 5, automatic watch",1210,1200,88,'))
  assert.ok(line.includes(`"'=HYPERLINK(""x"")"`))
  assert.ok(line.endsWith(',2,Approved by Ben,2026-10-07'))
})

test('XLSX round-trips with clickable links', () => {
  const wb = XLSX.read(toXlsx([row], { poeLinks: true, docs: true }), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]!]!
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)
  assert.equal(rows[0]!['Title'], row.title)
  assert.equal(rows[0]!['Guideline score'], 88)
  const linkCol = headers({ poeLinks: true, docs: true }).indexOf('Poe preview link')
  assert.equal(ws[XLSX.utils.encode_cell({ r: 1, c: linkCol })]?.l?.Target, row.poeLink)
})

test('draftHash changes with title or draft; filenames are tidy', () => {
  assert.equal(draftHash('A', '<p>x</p>'), draftHash('A', '<p>x</p>'))
  assert.notEqual(draftHash('A', '<p>x</p>'), draftHash('B', '<p>x</p>'))
  assert.notEqual(draftHash('A', '<p>x</p>'), draftHash('A', '<p>y</p>'))
  assert.equal(exportFilename('The Watch Store PH', 'xlsx', new Date('2026-10-07T00:00:00Z')), 'the-watch-store-ph-articles-2026-10-07.xlsx')
})
