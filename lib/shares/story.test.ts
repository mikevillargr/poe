import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HistoryEvent } from '@/lib/articles/history-format'
import { buildStory, storyTotals } from './story'
import { publicEvent } from './public-event'

let n = 0
const ev = (type: string, payload: Record<string, unknown> | null = null, who = 'ana', extra: Partial<HistoryEvent> = {}): HistoryEvent => ({
  id: `e${++n}`,
  type,
  at: `2026-10-0${Math.min(9, 1 + (n % 8))}T10:00:00.000Z`,
  userId: who,
  userName: who === 'ana' ? 'Ana Cruz' : 'Ben Lim',
  userImage: null,
  fromStatus: null,
  toStatus: null,
  payload,
  ...extra,
})

const events: HistoryEvent[] = [
  ev('imported', { importBatchId: 'b' }),
  ev('fields_edited', { changes: [{ field: 'brief', from: 'a', to: 'b' }] }),
  ev('researched', { citations: 9, model: 'kimi' }),
  ev('generated', { wordCount: 1100, model: 'claude' }),
  ev('generated', { wordCount: 1150, snapshotVersionNo: 2 }),
  ev('draft_edited', { wordsBefore: 1150, wordsAfter: 1300 }),
  ev('draft_edited', { wordsBefore: 1300, wordsAfter: 1240 }, 'ben'),
  ev('ai_edit_applied', { mode: 'improve' }),
  ev('guidelines_checked', { score: 84, rules: { universal: 46, client: 6 } }),
  ev('suggestion_accepted', { title: 'x' }),
  ev('suggestion_dismissed', { title: 'y' }),
  ev('status_changed', null, 'ben', { fromStatus: 'draft', toStatus: 'in_review' }),
]

test('buildStory summarises each step with human-in-the-loop numbers', () => {
  const steps = buildStory({ events, researchEnabled: true, status: 'in_review', score: 84 })
  const by = Object.fromEntries(steps.map((s) => [s.key, s]))
  assert.deepEqual(steps.map((s) => s.key), ['brief', 'research', 'draft', 'editing', 'check', 'review'])
  assert.deepEqual(by.brief!.stats, ['Imported from the content calendar', 'Refined 1 time'])
  assert.deepEqual(by.research!.stats, ['9 sources found'])
  assert.deepEqual(by.draft!.stats, ['First draft: 1,100 words', 'Regenerated 1 time'])
  assert.deepEqual(by.editing!.stats, ['2 editing sessions · +150 / −60 words', '1 AI-assisted rewrite, each approved by an editor', '2 editors involved'])
  assert.deepEqual(by.check!.stats, ['Score 84/100', '52 rules checked', '2 suggestions reviewed by an editor · 1 applied'])
  assert.equal(by.review!.state, 'done')
  assert.deepEqual(by.review!.people.map((p) => p.name), ['Ben Lim'])
  assert.ok(steps.every((s) => s.state === 'done'))
})

test('steps not reached yet are pending; research off is skipped', () => {
  const steps = buildStory({ events: [ev('created')], researchEnabled: false, status: 'queued', score: null })
  assert.deepEqual(
    steps.map((s) => s.state),
    ['done', 'skipped', 'pending', 'pending', 'pending', 'pending'],
  )
})

test('storyTotals counts people and human actions', () => {
  assert.deepEqual(storyTotals(events), { people: 2, humanActions: 7 })
})

test('publicEvent drops internal text but keeps what sentences need', () => {
  const e = publicEvent(ev('fields_edited', { changes: [{ field: 'brief', from: 'secret', to: 'new' }] }))
  assert.deepEqual(e.payload, { changes: [{ field: 'brief' }] })
  const r = publicEvent(ev('revised', { feedback: 'internal note', wordCount: 900, model: 'm' }))
  assert.deepEqual(r.payload, { wordCount: 900, model: 'm' })
  const s = publicEvent(ev('suggestion_accepted', { title: 'Tone', original: 'a', suggested: 'b', category: 'brand' }))
  assert.deepEqual(s.payload, { title: 'Tone', category: 'brand' })
})
