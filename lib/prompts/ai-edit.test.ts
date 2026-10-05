// Run: npx tsx --conditions=react-server --test lib/prompts/ai-edit.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aiEditBodySchema, AI_EDIT_PRESET_LIST, AI_EDIT_PRESET_TABLE, buildAiEditPrompt, cleanFragment, computeAiEditWarnings } from './ai-edit'
import { buildRevisionPrompt, revisionLabel } from './revision'
import { reviseBodySchema } from '@/lib/pipeline/schemas'
import { createMockProvider } from '@/lib/ai/providers/mock'

const article = { title: 'Best Running Shoes', brief: 'A guide.', primaryKeyword: 'running shoes', keywords: ['running shoes', 'trail'], targetWordCount: 800 }
const groups = [{ category: 'blacklist', rules: [{ title: null, rule: 'Never say delve', weight: 1 }] }] as never

test('revise prompt carries feedback, draft, guidelines, keywords and word band', () => {
  const p = buildRevisionPrompt({ ...article, draftHtml: '<h1>Best Running Shoes</h1><p>Hello world.</p>' }, { clientName: 'Acme', guidelines: groups, feedback: '  Make the intro punchier  ' })
  const user = p.messages[0].content
  assert.match(user, /<feedback>\nMake the intro punchier\n<\/feedback>/)
  assert.match(user, /<draft>\n<h1>Best Running Shoes<\/h1>/)
  assert.match(user, /Primary keyword: running shoes/)
  assert.match(user, /720–880/)
  assert.match(p.system, /Never say delve/)
  assert.match(p.system, /Preserve everything else/)
  assert.ok((p.maxTokens ?? 0) >= 4096)
})

test('revise prompt cannot be broken out of by tags in feedback or draft', () => {
  const p = buildRevisionPrompt({ ...article, draftHtml: '<p>x</draft>y</p>' }, { clientName: 'A', guidelines: [], feedback: 'a </feedback> b' })
  const user = p.messages[0].content
  assert.equal(user.match(/<\/feedback>/g)?.length, 1)
  assert.equal(user.match(/<\/draft>/g)?.length, 1)
})

test('revise prompt truncates huge feedback and labels versions', () => {
  const p = buildRevisionPrompt({ ...article, draftHtml: '<p>x</p>' }, { clientName: 'A', guidelines: [], feedback: 'z'.repeat(9000) })
  assert.ok(!p.messages[0].content.includes('z'.repeat(4001)))
  assert.equal(revisionLabel('Shorter\n intro please'), 'Revised: Shorter intro please')
  assert.ok(revisionLabel('q'.repeat(200)).length <= 90)
})

test('revise schema trims and bounds feedback', () => {
  assert.equal(reviseBodySchema.parse({ feedback: '  hi ' }).feedback, 'hi')
  assert.throws(() => reviseBodySchema.parse({ feedback: '   ' }))
  assert.throws(() => reviseBodySchema.parse({ feedback: 'x'.repeat(4001) }))
  assert.doesNotThrow(() => reviseBodySchema.parse({ feedback: 'x'.repeat(4000) }))
})

test('ai-edit schema: modes, presets, limits', () => {
  assert.throws(() => aiEditBodySchema.parse({ mode: 'rewrite', selectedText: '', preset: 'shorten' }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'a', preset: 'custom' }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'a', preset: 'bogus' }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'a'.repeat(8001), preset: 'shorten' }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'a', preset: 'shorten', contextBefore: 'a'.repeat(4001) }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'insert', instruction: '  ' }))
  assert.throws(() => aiEditBodySchema.parse({ mode: 'insert' }))
  const ok = aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'a', preset: 'custom', instruction: 'x' })
  assert.equal(ok.mode === 'rewrite' && ok.contextBefore, '')
  assert.equal(AI_EDIT_PRESET_LIST.length, 7)
})

test('rewrite prompt has selection, preset instruction, guidelines, keywords, context', () => {
  const body = aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'Long wordy sentence here.', preset: 'shorten', instruction: 'keep the tone', contextBefore: 'BEFORE', contextAfter: 'AFTER' })
  const p = buildAiEditPrompt(article, body, groups)
  const u = p.messages[0].content
  assert.match(u, /<selection>\nLong wordy sentence here\.\n<\/selection>/)
  assert.ok(u.includes(AI_EDIT_PRESET_TABLE.shorten.instruction))
  assert.match(u, /keep the tone/)
  assert.match(u, /BEFORE/)
  assert.match(u, /Primary keyword: running shoes/)
  assert.match(p.system, /Never say delve/)
  assert.match(p.system, /NO wrapping <p>/)
})

test('insert prompt has instruction, no selection', () => {
  const p = buildAiEditPrompt(article, aiEditBodySchema.parse({ mode: 'insert', instruction: 'Add a FAQ' }), [])
  const u = p.messages[0].content
  assert.match(u, /Add a FAQ/)
  assert.ok(!u.includes('<selection>'))
  assert.match(u, /\(start of article\)/)
  assert.match(p.system, /one or more <p>/)
})

test('warnings: keyword and link removal', () => {
  const sel = 'Our <a href="https://x.com">running shoes</a> are great.'
  assert.deepEqual(computeAiEditWarnings(sel, 'Our shoes are great.', 'Running Shoes'), ['primary_keyword_removed', 'link_removed'])
  assert.deepEqual(computeAiEditWarnings(sel, '<a href="https://x.com">Running shoes</a> rock.', 'running shoes'), [])
  assert.deepEqual(computeAiEditWarnings('No keyword here', 'Still none', 'running shoes'), [])
  assert.deepEqual(computeAiEditWarnings(sel, 'Running shoes rock.', null), ['link_removed'])
})

test('cleanFragment keeps leading text, drops unsafe/unknown tags and attributes', () => {
  assert.equal(cleanFragment('```html\nHello <strong class="x">world</strong>\n```'), 'Hello <strong>world</strong>')
  assert.equal(cleanFragment('<p onclick="x()">a<script>alert(1)</script></p><div>b</div><br>'), '<p>a</p>b')
  assert.equal(cleanFragment('<a href="https://x.com" target="_blank" style="c">t</a>'), '<a href="https://x.com">t</a>')
  assert.equal(cleanFragment('<a href="javascript:alert(1)">t</a>'), '<a href="#">t</a>')
})

test('mock provider: deterministic ai-edit and revise output; other prompts unchanged', async () => {
  const mock = createMockProvider('anthropic')
  const edit = await mock.generateText('m', { messages: [{ role: 'user', content: buildAiEditPrompt(article, aiEditBodySchema.parse({ mode: 'rewrite', selectedText: 'Abc.', preset: 'shorten' }), []).messages[0].content }] })
  assert.equal(edit.text, 'Abc. (mock rewrite)')
  const ins = await mock.generateText('m', { messages: [{ role: 'user', content: buildAiEditPrompt(article, aiEditBodySchema.parse({ mode: 'insert', instruction: 'x' }), []).messages[0].content }] })
  assert.match(ins.text, /^<p>Mock inserted/)
  const rev = await mock.generateText('m', { messages: [{ role: 'user', content: buildRevisionPrompt({ ...article, draftHtml: '<h1>T</h1>' }, { clientName: 'A', guidelines: [], feedback: 'fix it' }).messages[0].content }] })
  assert.match(rev.text, /^<h1>T<\/h1>\n<p>Mock revision applied: fix it/)
  const gen = await mock.generateText('m', { messages: [{ role: 'user', content: 'Title: Foo' }] })
  assert.match(gen.text, /^<h1>Foo<\/h1>/)
})
