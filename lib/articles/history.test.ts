import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeDraftEdits, mergeFieldChanges } from './provenance-merge'
import { describeHistoryEvent, groupByDay, historyGroup, historyMeta, type HistoryEvent } from './history-format'
import { draftDiff, htmlToParagraphs } from './draft-diff'

const ev = (type: string, payload: Record<string, unknown> | null = null, extra: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: 'e1',
  type,
  at: '2026-10-07T10:00:00.000Z',
  userId: 'u1',
  userName: 'Ana',
  userImage: null,
  fromStatus: null,
  toStatus: null,
  payload,
  ...extra,
})

test('mergeFieldChanges keeps the first "from" and the latest "to" per field', () => {
  const prev = { changes: [{ field: 'title', from: 'A', to: 'B' }] }
  const next = { changes: [{ field: 'title', from: 'B', to: 'C' }, { field: 'brief', from: 'x', to: 'y' }] }
  assert.deepEqual(mergeFieldChanges(prev, next), {
    changes: [
      { field: 'title', from: 'A', to: 'C' },
      { field: 'brief', from: 'x', to: 'y' },
    ],
  })
})

test('mergeFieldChanges drops a field edited back to where it started', () => {
  const merged = mergeFieldChanges({ changes: [{ field: 'keywords', from: ['a'], to: ['a', 'b'] }] }, { changes: [{ field: 'keywords', from: ['a', 'b'], to: ['a'] }] })
  assert.deepEqual(merged, { changes: [] })
})

test('mergeDraftEdits keeps the session start and checkpoint, counts saves', () => {
  const prev = { wordsBefore: 1000, wordsAfter: 1010, saves: 2, checkpointVersionNo: 7 }
  const next = { wordsBefore: 1010, wordsAfter: 1050, saves: 1 }
  assert.deepEqual(mergeDraftEdits(prev, next), { wordsBefore: 1000, wordsAfter: 1050, saves: 3, checkpointVersionNo: 7 })
})

test('describeHistoryEvent reads as a sentence', () => {
  assert.equal(describeHistoryEvent(ev('status_changed', null, { fromStatus: 'draft', toStatus: 'in_review' })), 'moved it from Draft to In Review')
  assert.equal(describeHistoryEvent(ev('fields_edited', { changes: [{ field: 'brief' }, { field: 'primaryKeyword' }, { field: 'title' }] })), 'edited the brief, primary keyword and title')
  assert.equal(describeHistoryEvent(ev('assigned', { from: null, to: 'u2' }), { u2: 'Ben' }), 'assigned it to Ben')
  assert.equal(describeHistoryEvent(ev('assigned', { from: 'u2', to: 'u1' })), 'took ownership')
  assert.equal(describeHistoryEvent(ev('assigned', { from: null, to: 'u1', reason: 'started generation' })), 'became the owner by starting a run')
  assert.equal(describeHistoryEvent(ev('generated', { snapshotVersionNo: 3 })), 'regenerated the draft')
  assert.equal(describeHistoryEvent(ev('exported', { format: 'docx' })), 'downloaded it as DOCX')
  assert.equal(describeHistoryEvent(ev('research_setting', { on: false })), 'turned research off')
  assert.equal(describeHistoryEvent(ev('something_new')), 'something new')
})

test('historyMeta summarises word counts, checks and sources', () => {
  assert.equal(historyMeta(ev('draft_edited', { wordsBefore: 1200, wordsAfter: 1080, saves: 4 })), '−120 words · 1,080 total · 4 saves')
  assert.equal(historyMeta(ev('guidelines_checked', { score: 81, suggestions: 1, rules: { universal: 46, client: 6 } })), '1 suggestion · 52 rules')
  assert.equal(historyMeta(ev('sources_changed', { excluded: 2, total: 9 })), '7 of 9 sources used')
  assert.equal(historyMeta(ev('status_changed')), null)
})

test('historyGroup files every recorded type under a filter', () => {
  assert.equal(historyGroup('suggestion_reworded'), 'suggestions')
  assert.equal(historyGroup('ai_edit_applied'), 'ai')
  assert.equal(historyGroup('sources_changed'), 'research')
  assert.equal(historyGroup('assigned'), 'status')
})

test('groupByDay buckets Today, Yesterday and older dates', () => {
  const now = new Date(2026, 9, 7, 15)
  const days = groupByDay(
    [{ at: new Date(2026, 9, 7, 9).toISOString() }, { at: new Date(2026, 9, 6, 22).toISOString() }, { at: new Date(2026, 9, 6, 8).toISOString() }, { at: new Date(2026, 9, 1).toISOString() }],
    now,
  )
  assert.deepEqual(
    days.map((d) => [d.label, d.events.length]),
    [
      ['Today', 1],
      ['Yesterday', 2],
      ['Thu, Oct 1', 1],
    ],
  )
})

test('draftDiff marks edited words and folds unchanged paragraphs', () => {
  const before = '<h2>Intro</h2><p>One two three.</p><p>Keep a.</p><p>Keep b.</p><p>Keep c.</p><p>Old ending here.</p>'
  const after = '<h2>Intro</h2><p>One two four.</p><p>Keep a.</p><p>Keep b.</p><p>Keep c.</p><p>Old ending here.</p><p>Brand new.</p>'
  assert.deepEqual(htmlToParagraphs(before).slice(0, 2), ['Intro', 'One two three.'])
  const hunks = draftDiff(before, after)
  assert.deepEqual(hunks[0], { type: 'same', text: 'Intro' })
  assert.deepEqual(hunks[1], {
    type: 'edit',
    parts: [
      { type: 'same', text: 'One two' },
      { type: 'remove', text: 'three.' },
      { type: 'add', text: 'four.' },
    ],
  })
  assert.deepEqual(hunks[2], { type: 'same', text: 'Keep a.' })
  assert.deepEqual(hunks[3], { type: 'skip', count: 2 })
  assert.deepEqual(hunks.slice(4), [
    { type: 'same', text: 'Old ending here.' },
    { type: 'add', text: 'Brand new.' },
  ])
})
