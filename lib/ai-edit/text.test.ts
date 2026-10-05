import test from 'node:test'
import assert from 'node:assert/strict'
import { adjustInstruction, clipContext, plainPreview, plainToHtml, unwrapInline, warningMessages } from './text'
import { aiEditReducer, CLOSED, canAccept, type AiEditState } from './state'

test('clipContext keeps the end of before and the start of after, on word boundaries', () => {
  const before = 'alpha beta gamma delta epsilon'
  const after = 'zeta eta theta iota kappa'
  const c = clipContext(before, after, 14)
  assert.equal(c.contextBefore, 'delta epsilon')
  assert.equal(c.contextAfter, 'zeta eta')
  assert.ok(c.contextBefore.length <= 14 && c.contextAfter.length <= 14)
})
test('clipContext leaves short context alone and trims it', () => {
  assert.deepEqual(clipContext(' a b ', ' c d '), { contextBefore: 'a b', contextAfter: 'c d' })
})
test('clipContext respects the 4000 default', () => {
  const big = 'word '.repeat(2000)
  const c = clipContext(big, big)
  assert.ok(c.contextBefore.length <= 4000 && c.contextAfter.length <= 4000)
})
test('warningMessages maps known codes, dedupes, ignores unknown', () => {
  const m = warningMessages(['primary_keyword_removed', 'link_removed', 'link_removed', 'nope'])
  assert.equal(m.length, 2)
  assert.match(m[0], /primary keyword/)
  assert.deepEqual(warningMessages(undefined), [])
})
test('plainPreview strips tags, fences and partial tags', () => {
  assert.equal(plainPreview('```html\n<p>One &amp; two</p><p>Three</p>\n```'), 'One & two\n\nThree')
  assert.equal(plainPreview('<p>Partial <str'), 'Partial')
})
test('unwrapInline unwraps a single paragraph only', () => {
  assert.equal(unwrapInline('<p>Hi <strong>there</strong></p>'), 'Hi <strong>there</strong>')
  assert.equal(unwrapInline('<p>A</p><p>B</p>'), '<p>A</p><p>B</p>')
  assert.equal(unwrapInline('Plain'), 'Plain')
})
test('plainToHtml escapes and splits paragraphs', () => {
  assert.equal(plainToHtml('a <b>\n\nc', false), '<p>a &lt;b&gt;</p><p>c</p>')
  assert.equal(plainToHtml('a\nb', true), 'a b')
})
test('adjustInstruction combines preset instruction with the extra and caps length', () => {
  const t = adjustInstruction('shorten', '', 'keep the second clause')
  assert.match(t, /shorter/)
  assert.match(t, /Additionally: keep the second clause/)
  assert.equal(adjustInstruction('custom', 'Make it punchy', 'but polite'), 'Make it punchy Additionally: but polite')
  assert.ok(adjustInstruction(null, 'x'.repeat(2000), 'y').length <= 1000)
})

const open = (): AiEditState => aiEditReducer(CLOSED, { type: 'open', mode: 'rewrite', original: 'Some text' })
test('state machine: prompt → streaming → preview → accept allowed', () => {
  let s = open()
  assert.equal(s.phase, 'prompt')
  s = aiEditReducer(s, { type: 'run', preset: 'shorten', instruction: '' })
  assert.equal(s.phase, 'streaming')
  assert.equal(canAccept(s), false)
  s = aiEditReducer(s, { type: 'result', html: 'Short', warnings: ['link_removed'] })
  assert.equal(s.phase, 'preview')
  assert.equal(canAccept(s), true)
  assert.deepEqual(s.warnings, ['link_removed'])
})
test('state machine: failure, adjust, stop and re-run paths', () => {
  let s = aiEditReducer(open(), { type: 'run', preset: 'custom', instruction: 'x' })
  s = aiEditReducer(s, { type: 'fail', message: 'boom' })
  assert.equal(s.phase, 'error')
  assert.equal(s.error, 'boom')
  s = aiEditReducer(s, { type: 'run', preset: 'custom', instruction: 'y' })
  assert.equal(s.phase, 'streaming')
  assert.equal(aiEditReducer(s, { type: 'stopped' }).phase, 'prompt')
  s = aiEditReducer(s, { type: 'result', html: 'ok', warnings: [] })
  assert.equal(aiEditReducer(s, { type: 'adjust' }).phase, 'prompt')
})
test('state machine: ignores late events and stale/close behave', () => {
  const c = aiEditReducer(CLOSED, { type: 'result', html: 'late', warnings: [] })
  assert.equal(c.phase, 'closed')
  let s = aiEditReducer(open(), { type: 'run', preset: 'shorten', instruction: '' })
  s = aiEditReducer(s, { type: 'stale' })
  assert.equal(s.phase, 'stale')
  assert.equal(aiEditReducer(s, { type: 'result', html: 'x', warnings: [] }).phase, 'stale')
  assert.equal(canAccept(s), false)
  assert.equal(aiEditReducer(s, { type: 'close' }).phase, 'closed')
})
