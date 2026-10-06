// Run: npx tsx --conditions=react-server --test lib/templates/engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blogCleanup, sharedCleanup, stripCodeFence, tightenAfterHeadings } from './cleanup'
import { parseMarkers } from './markers'
import { inlineMarkdown, markdownToHtml } from './markdown'
import { currentYear, listPlaceholders, parseWordRange, renderPlaceholders, resolveWordCount } from './placeholders'
import { extractUrls, filterToCandidates, formatSectioned, parseSectionedUrls } from './selector'

test('placeholders: render, report missing, list', () => {
  const r = renderPlaceholders('Title: {{BLOG_TITLE}} ({{ WORD_COUNT }}) {{NOPE}} {{BLOG_TITLE}}', { BLOG_TITLE: 'Ribeye', WORD_COUNT: 900 })
  assert.equal(r.text, 'Title: Ribeye (900) {{NOPE}} Ribeye')
  assert.deepEqual(r.missing, ['NOPE'])
  assert.deepEqual(listPlaceholders('{{A}} {{B_2}} {{A}} {{lower}}'), ['A', 'B_2'])
  assert.equal(renderPlaceholders('{{X}}', { X: '' }).text, '', 'empty string is a value, not missing')
})

test('word count: blank uses the template default, stray "=" removed, ranges parsed', () => {
  assert.equal(resolveWordCount('', '1500-2000'), '1500-2000')
  assert.equal(resolveWordCount(undefined), '1500-2500')
  assert.equal(resolveWordCount('=1800'), '1800')
  assert.equal(resolveWordCount(1200), '1200')
  assert.deepEqual(parseWordRange('1,500 – 2,500'), { min: 1500, max: 2500 })
  assert.deepEqual(parseWordRange('1800'), { min: 1800, max: 1800 })
  assert.equal(parseWordRange('n/a'), null)
  assert.equal(currentYear(new Date('2026-10-06T00:00:00Z')), '2026')
})

const MARKERS = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'MAIN_CONTENT', 'CONCLUSION_HEADER', 'CONCLUSION']

test('markers: plain, bold, no colon, inline value, case-insensitive, missing → empty', () => {
  const text = [
    'ARTICLE_TITLE:',
    'How to Grill Ribeye',
    '**META_TITLE:** Grill Ribeye Like a Pro',
    'meta_description',
    'A short guide.',
    'MAIN_CONTENT:',
    'Intro paragraph.',
    '## First section',
    'Conclusion is not a marker when a sentence follows.',
    '**CONCLUSION_HEADER**',
    'Fire Up the Grill',
    'Conclusion:',
    'Para one.',
  ].join('\n')
  const s = parseMarkers(text, MARKERS)
  assert.equal(s.ARTICLE_TITLE, 'How to Grill Ribeye')
  assert.equal(s.META_TITLE, 'Grill Ribeye Like a Pro')
  assert.equal(s.META_DESCRIPTION, 'A short guide.')
  assert.equal(s.MAIN_CONTENT, 'Intro paragraph.\n## First section\nConclusion is not a marker when a sentence follows.')
  assert.equal(s.CONCLUSION_HEADER, 'Fire Up the Grill')
  assert.equal(s.CONCLUSION, 'Para one.')
  assert.equal(parseMarkers('MAIN_CONTENT:\nbody', MARKERS).CONCLUSION, '')
  assert.equal(parseMarkers('ARTICLE TITLE: Spaced', MARKERS).ARTICLE_TITLE, 'Spaced')
})

test('cleanup: rules, blank lines, headings, table bold', () => {
  assert.equal(sharedCleanup('  a\n---\n\n\n\nb\n -----  \nc  '), 'a\n\nb\nc')
  assert.equal(blogCleanup('## A\n\n### B\n\ntext\n\n## C'), '## A\n### B\n\ntext\n\n## C')
  assert.equal(blogCleanup('| **Fee** | $425 |\nnot **a** row'), '| Fee | $425 |\nnot **a** row')
  assert.equal(tightenAfterHeadings('## Key Takeaways\n\n- one', ['## Key Takeaways']), '## Key Takeaways\n- one')
  assert.equal(stripCodeFence('```markdown\n## Summary\nx\n```'), '## Summary\nx')
})

test('markdown: headings, per-line paragraphs, lists, tables, links, escaping', () => {
  const html = markdownToHtml(
    [
      '# Title',
      '**Meta Title:** Short',
      '## Section',
      'A [link](https://a.com/x) and *em* and **bold**.',
      '- one',
      '- two',
      '1. first',
      '2. second',
      '#### Too deep',
      '| Fee | Amount |',
      '|---|---|',
      '| Filing | $425 |',
      'https://www.youtube.com/watch?v=abc',
      '<script>alert(1)</script>',
    ].join('\n'),
  )
  assert.equal(
    html,
    [
      '<h1>Title</h1>',
      '<p><strong>Meta Title:</strong> Short</p>',
      '<h2>Section</h2>',
      '<p>A <a href="https://a.com/x">link</a> and <em>em</em> and <strong>bold</strong>.</p>',
      '<ul><li><p>one</p></li><li><p>two</p></li></ul>',
      '<ol><li><p>first</p></li><li><p>second</p></li></ol>',
      '<p><strong>Too deep</strong></p>',
      '<table><thead><tr><th>Fee</th><th>Amount</th></tr></thead><tbody><tr><td>Filing</td><td>$425</td></tr></tbody></table>',
      '<p><a href="https://www.youtube.com/watch?v=abc">https://www.youtube.com/watch?v=abc</a></p>',
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    ].join('\n'),
  )
  assert.equal(inlineMarkdown('[x](javascript:alert(1))'), 'x)', 'unsafe link becomes text')
  assert.equal(inlineMarkdown('snake_case_word stays'), 'snake_case_word stays')
})

test('selector: url lists, sections, hallucinations dropped', () => {
  assert.deepEqual(extractUrls('https://a.com/1, https://a.com/2.\nhttps://a.com/1/'), ['https://a.com/1', 'https://a.com/2'])
  const s = parseSectionedUrls('**ARTICLE_URLS:**\nhttps://x.com/a, https://x.com/b\n\n**PRODUCT_URLS:**\nhttps://x.com/p1')
  assert.deepEqual(s, { articles: ['https://x.com/a', 'https://x.com/b'], products: ['https://x.com/p1'] })
  assert.equal(formatSectioned(s), 'ARTICLE_URLS:\nhttps://x.com/a, https://x.com/b\n\nPRODUCT_URLS:\nhttps://x.com/p1')
  const f = filterToCandidates(['https://x.com/a', 'https://made.up/z'], ['Title A-https://www.x.com/a/', 'Other-https://x.com/c'])
  assert.deepEqual(f, { kept: ['https://www.x.com/a/'], dropped: ['https://made.up/z'] }, 'kept as the candidate spells it')
  assert.deepEqual(filterToCandidates(['https://x.com/p'], ['slug-only - Product']).kept, ['https://x.com/p'], 'slug lists cannot be checked')
})
