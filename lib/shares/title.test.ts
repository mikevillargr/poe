import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stripLeadingTitle } from './title'

test('drops a leading H1 that repeats the title (case, punctuation and entities aside)', () => {
  assert.equal(stripLeadingTitle('<h1>How to Choose Boots: A Guide</h1><p>Body</p>', 'How to choose boots — a guide'), '<p>Body</p>')
  assert.equal(stripLeadingTitle('  <h1 class="x">Trail &amp; Summit</h1>\n<p>Body</p>', 'Trail & Summit'), '<p>Body</p>')
})

test('keeps a leading H1 that says something else, and later H1s', () => {
  assert.equal(stripLeadingTitle('<h1>Something else</h1><p>Body</p>', 'Boots'), '<h1>Something else</h1><p>Body</p>')
  assert.equal(stripLeadingTitle('<p>Intro</p><h1>Boots</h1>', 'Boots'), '<p>Intro</p><h1>Boots</h1>')
})
