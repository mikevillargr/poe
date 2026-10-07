import { test } from 'node:test'
import assert from 'node:assert/strict'
import { changedInputs, draftInputs, hashText, type DraftInputSource } from './draft-inputs'

const base: DraftInputSource = {
  title: 'Nevada Annual List Fees',
  brief: 'Fees and deadlines',
  keywords: ['nevada annual list', 'late penalty'],
  primaryKeyword: 'nevada annual list',
  targetWordCount: 1200,
  templateId: null,
  templateInputs: null,
  researchEnabled: true,
  research: { summary: 'S', outlineHtml: '<ul><li>a</li></ul>', citations: [{ url: 'https://a.com' }, { url: 'https://b.com' }] },
}

test('unchanged inputs (whitespace/case noise ignored) report nothing', () => {
  const a = draftInputs(base)
  const b = draftInputs({ ...base, brief: '  Fees   and deadlines ', keywords: ['Nevada Annual List', 'late penalty'] })
  assert.deepEqual(changedInputs(a, b), [])
})

test('reports exactly the fields that changed, in a stable order', () => {
  const a = draftInputs(base)
  const b = draftInputs({ ...base, brief: 'Fees, deadlines and penalties', targetWordCount: 1500, keywords: [...base.keywords, 'nv sos'] })
  assert.deepEqual(changedInputs(a, b), ['Brief', 'Keywords', 'Target length'])
})

test('research: excluding a source or switching research off counts as a change', () => {
  const a = draftInputs(base)
  const excluded = draftInputs({ ...base, research: { ...(base.research as object), citations: [{ url: 'https://a.com' }, { url: 'https://b.com', excluded: true }] } })
  assert.deepEqual(changedInputs(a, excluded), ['Research'])
  assert.deepEqual(changedInputs(a, draftInputs({ ...base, researchEnabled: false })), ['Research'])
})

test('no recorded inputs (drafts before this feature) → no hint', () => {
  assert.deepEqual(changedInputs(null, draftInputs(base)), [])
})

test('empty template inputs ({} or null) are not a change, including older saved fingerprints', () => {
  const a = draftInputs({ ...base, templateInputs: {} })
  const b = draftInputs({ ...base, templateInputs: null })
  assert.equal(a.template, b.template)
  const legacy = { ...b, template: `:${hashText('[]')}` }
  assert.deepEqual(changedInputs(legacy, b), [])
  assert.deepEqual(changedInputs({ ...b, template: 'tpl-1:x' }, b), ['Template'])
})
