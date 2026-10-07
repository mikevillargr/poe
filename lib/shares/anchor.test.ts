import { test } from 'node:test'
import assert from 'node:assert/strict'
import { locateAnchor, makeAnchor } from './anchor'
import { notificationText } from '@/lib/notifications/format'
import { describeHistoryEvent, historyActor, historyGroup, historyMeta, type HistoryEvent } from '@/lib/articles/history-format'

const text = 'Dive watches need 200m water resistance. A dive watch also needs a bezel. Every dive watch is tested.'

test('makeAnchor keeps the quote and some context on each side', () => {
  const start = text.indexOf('A dive watch')
  const a = makeAnchor(text, start, start + 'A dive watch'.length)
  assert.equal(a.quote, 'A dive watch')
  assert.ok(a.prefix.endsWith('resistance. '))
  assert.ok(a.suffix.startsWith(' also needs'))
})

test('locateAnchor picks the right one of several matches by context', () => {
  const start = text.lastIndexOf('dive watch')
  const a = makeAnchor(text, start, start + 'dive watch'.length)
  assert.deepEqual(locateAnchor(text, a), { start, end: start + 10 })
})

test('locateAnchor survives edits around the quote and whitespace changes', () => {
  const start = text.indexOf('a bezel')
  const a = makeAnchor(text, start, start + 'a bezel'.length)
  const edited = 'NEW INTRO.  ' + text.replace('also needs', 'also   really needs')
  const hit = locateAnchor(edited, a)
  assert.ok(hit)
  assert.equal(edited.replace(/\s+/g, ' ').slice(hit!.start, hit!.end), 'a bezel')
})

test('locateAnchor returns null when the quote was edited away', () => {
  const a = makeAnchor(text, 0, 13)
  assert.equal(locateAnchor(text.replace('Dive watches', 'Divers’ watches'), a), null)
})

test('notification sentences', () => {
  assert.equal(notificationText('comment_added', { name: 'Ana' }, 'Seiko 5'), 'Ana commented on “Seiko 5”')
  assert.equal(notificationText('changes_requested', {}, 'Seiko 5'), 'Someone requested changes to “Seiko 5”')
})

const ev = (type: string, payload: Record<string, unknown>): HistoryEvent => ({
  id: 'e',
  type,
  at: '2026-10-07T10:00:00.000Z',
  userId: null,
  userName: null,
  userImage: null,
  fromStatus: null,
  toStatus: null,
  payload,
})

test('feedback events: guest names, sentences, filter group', () => {
  const c = ev('comment_added', { name: 'Client Ana', quote: 'a bezel' })
  assert.equal(historyActor(c), 'Client Ana')
  assert.equal(describeHistoryEvent(c), 'commented on a passage')
  assert.equal(historyMeta(c), '“a bezel”')
  assert.equal(historyGroup('client_approved'), 'feedback')
  assert.equal(describeHistoryEvent(ev('changes_requested', { name: 'Ana', note: 'Shorter intro' })), 'requested changes')
  assert.equal(historyMeta(ev('changes_requested', { note: 'Shorter intro' })), 'Shorter intro')
})
