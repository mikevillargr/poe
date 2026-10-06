// Run: npx tsx --conditions=react-server --test lib/templates/assembly.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assemble } from './assembly'
import { bodyWordCount, failedChecks, retryInstructions, runChecks } from './checks'
import type { AssembledOutput, CheckConfig } from './types'

const META_BLOG = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'MAIN_CONTENT', 'CONCLUSION_HEADER', 'CONCLUSION']
const TWS = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'KEY_TAKEAWAYS', 'MAIN_CONTENT', 'FAQ_SECTION', 'CONCLUSION_HEADER', 'CONCLUSION']
const NCH = ['ARTICLE_TITLE', 'META_TITLE', 'META_DESCRIPTION', 'TLDR_SUMMARY', 'KEY_TAKEAWAYS', 'MAIN_CONTENT', 'VERDICT_SECTION', 'FAQ_SECTION', 'EXPERT_TIPS_FROM_NCH', 'CONCLUSION_HEADER', 'CONCLUSION']

test('raw recipe (product FAQ): cleaned response, row title', () => {
  const out = assemble({ recipe: 'raw', response: '## Q one?\n\nAnswer.\n---\n\n\n\n## Q two?\nAnswer.', markers: [], blogCleanup: false, fallbackTitle: 'F-150 Tonneau Cover' })
  assert.equal(out.markdown, '## Q one?\n\nAnswer.\n\n## Q two?\nAnswer.')
  assert.equal(out.title, 'F-150 Tonneau Cover')
})

test('meta-blog recipe (TB / UT / FIFA): H1, meta lines, main, conclusion', () => {
  const response = `**ARTICLE_TITLE:** How to Cook Pork Kasim
META_TITLE:
Pork Kasim Guide
META_DESCRIPTION:
Everything about kasim.
MAIN_CONTENT:
Intro.

## Choosing the Cut

### Bone-in

Text.
---
CONCLUSION_HEADER:
Ready for Your Next Handaan
CONCLUSION:
Para one.

Para two with [Visit TenderBites](https://tenderbites.ph).`
  const out = assemble({ recipe: 'meta-blog', response, markers: META_BLOG, blogCleanup: true, fallbackTitle: 'Ideation title' })
  assert.equal(
    out.markdown,
    `# How to Cook Pork Kasim

**Meta Title:** Pork Kasim Guide

**Meta Description:** Everything about kasim.

Intro.

## Choosing the Cut
### Bone-in

Text.

## Ready for Your Next Handaan

Para one.

Para two with [Visit TenderBites](https://tenderbites.ph).`,
  )
  assert.equal(out.metaTitle, 'Pork Kasim Guide')
  assert.equal(out.sections.CONCLUSION_HEADER, 'Ready for Your Next Handaan')
})

test('tws-blog recipe: missing headings added, bold questions → H3, tight headings', () => {
  const response = `ARTICLE_TITLE:
Best Tissot Watches
META_TITLE:
Best Tissot Watches 2026
META_DESCRIPTION:
Our picks.
KEY_TAKEAWAYS:
- **Swiss heritage** matters for Tissot.
- **Fit** comes first.
MAIN_CONTENT:
Intro.
## Why Tissot
Body.
FAQ_SECTION:
**Is Tissot Swiss-made?**
Yes, Tissot is Swiss.

### How do I size the strap?
Visit a store.
CONCLUSION_HEADER:
Find Your Tissot
CONCLUSION:
Close.`
  const out = assemble({ recipe: 'tws-blog', response, markers: TWS, blogCleanup: true, fallbackTitle: 'x' })
  assert.equal(
    out.markdown,
    `# Best Tissot Watches

**Meta Title:** Best Tissot Watches 2026

**Meta Description:** Our picks.

## Key Takeaways
- **Swiss heritage** matters for Tissot.
- **Fit** comes first.

Intro.
## Why Tissot
Body.

## Frequently Asked Questions
### Is Tissot Swiss-made?
Yes, Tissot is Swiss.

### How do I size the strap?
Visit a store.

## Find Your Tissot

Close.`,
  )
})

test('nch-blog recipe: summary line, fixed section headings, YouTube stays a raw line, ARTICLE_TITLE fallback', () => {
  const response = `META_TITLE:
Nevada LLC Cost 2026
META_DESCRIPTION:
A Nevada LLC costs $425 in state fees.
TLDR_SUMMARY:
It costs $425 plus agent fees.
KEY_TAKEAWAYS:
- **Filing fee** is $425.
MAIN_CONTENT:
## How Much Does a Nevada LLC Cost?
It costs $425.
https://www.youtube.com/watch?v=abc123
VERDICT_SECTION:
## Is a Nevada LLC Worth It?
Yes.
FAQ_SECTION:
### How do I form a Nevada LLC?
File articles.
EXPERT_TIPS_FROM_NCH:
1. Keep records.
CONCLUSION_HEADER:
Ready to Form Your LLC?
CONCLUSION:
[Contact NCH](https://nchinc.com/contact-nch) today.`
  const out = assemble({ recipe: 'nch-blog', response, markers: NCH, blogCleanup: true, fallbackTitle: 'How Much Does a Nevada LLC Cost?' })
  assert.equal(out.title, 'How Much Does a Nevada LLC Cost?')
  assert.equal(out.tldr, 'It costs $425 plus agent fees.')
  assert.equal(
    out.markdown,
    `# How Much Does a Nevada LLC Cost?

**Meta Title:** Nevada LLC Cost 2026

**Meta Description:** A Nevada LLC costs $425 in state fees.

**Blog Summary:** It costs $425 plus agent fees.

## Key Takeaways
- **Filing fee** is $425.

## How Much Does a Nevada LLC Cost?
It costs $425.
https://www.youtube.com/watch?v=abc123

## Is a Nevada LLC Worth It?
Yes.

## Frequently Asked Questions
### How do I form a Nevada LLC?
File articles.

## Expert Tips From NCH
1. Keep records.

## Ready to Form Your LLC?

[Contact NCH](https://nchinc.com/contact-nch) today.`,
  )
})

test('tribe-page recipe: fence and preamble dropped, title added, no shared cleanup', () => {
  const response = '```markdown\nHere is the page:\n## Summary\nText.\n\n\n\n## FAQ\n**Q?**\nA.\n```'
  const out = assemble({ recipe: 'tribe-page', response, markers: [], blogCleanup: false, fallbackTitle: 'Dominican Haitian' })
  assert.equal(out.title, 'Dominican Haitian Community Page')
  assert.equal(out.markdown, '# Dominican Haitian Community Page\n\n## Summary\nText.\n\n\n\n## FAQ\n**Q?**\nA.')
})

// ---- checks

function doc(markdown: string, sections: Record<string, string> = {}, extra: Partial<AssembledOutput> = {}): AssembledOutput {
  return { markdown, title: 't', sections, ...extra }
}

test('checks: markers, word count with tolerance, heading and question counts', () => {
  const md = `# T\n\n**Meta Title:** ignored words here\n\n${'word '.repeat(95)}\n\n## A\n## B`
  const out = doc(md, { ARTICLE_TITLE: 'T', MAIN_CONTENT: '## A\n## B', CONCLUSION: '' })
  const r = runChecks(out, { h2: { min: 4, max: 6 }, wordCountTolerance: 0.1 }, { markers: ['ARTICLE_TITLE', 'MAIN_CONTENT', 'CONCLUSION'], wordRange: { min: 100, max: 120 } })
  const byId = Object.fromEntries(r.map((c) => [c.id, c]))
  assert.equal(byId.markers.ok, false)
  assert.match(byId.markers.message, /CONCLUSION/)
  assert.equal(bodyWordCount(md), 98, 'meta lines are not counted')
  assert.equal(byId['word-count'].ok, true, '98 is within 100–120 ±10%')
  assert.equal(byId['h2-count'].ok, false)

  const faq = doc('## Q1?\nA.\n## Q2?\nA.')
  assert.equal(runChecks(faq, { questions: { level: 2, min: 10, max: 10 } }, { markers: [] }).find((c) => c.id === 'question-count')?.ok, false)
})

test('checks: links — count excludes CTA, supplied URLs only, no links in headings, lead-ins', () => {
  const md = `## Grill [tips](https://tb.ph/a)
Read about [kasim](https://tb.ph/b) and check out the [wagyu](https://made.up/x).
[Visit TenderBites](https://tenderbites.ph)`
  const r = runChecks(doc(md), { links: { min: 3, max: 5 }, onlySuppliedUrls: true }, {
    markers: [],
    suppliedUrls: ['https://tb.ph/a, https://tb.ph/b'],
    ctaUrls: ['https://tenderbites.ph'],
  })
  const byId = Object.fromEntries(r.map((c) => [c.id, c]))
  assert.equal(byId['link-count'].message, '3 internal links (expected 3–5)')
  assert.equal(byId['supplied-urls'].ok, false)
  assert.match(byId['supplied-urls'].message, /made\.up/)
  assert.equal(byId['no-heading-links'].ok, false)
  assert.equal(byId['no-lead-ins'].ok, false)
  // UT allows "Check out" as a CTA opener, so its lead-in list omits it.
  assert.equal(runChecks(doc(md), {}, { markers: [], leadIns: ['click here'] }).find((c) => c.id === 'no-lead-ins')?.ok, true)
})

test('checks: banned strings — em dash, phrases, Swiss/luxury proximity, 250k', () => {
  const twsChecks: CheckConfig = {
    proximity: [
      { label: 'Swiss', terms: ['swiss', 'swiss-made'], allowedWith: ['tissot', 'alpina', 'frederique constant', 'sandoz'] },
      { label: 'Luxury', terms: ['luxury', 'luxurious'], allowedWith: ['frederique constant'] },
    ],
  }
  const good = doc('Tissot offers Swiss precision. Frederique Constant is a luxury pick.')
  assert.ok(runChecks(good, twsChecks, { markers: [] }).filter((c) => c.id.startsWith('proximity')).every((c) => c.ok))
  const bad = doc('Seiko brings Swiss-made quality. Coach is luxurious.')
  assert.equal(failedChecks(runChecks(bad, twsChecks, { markers: [] })).filter((c) => c.id.startsWith('proximity')).length, 2)

  const nch = runChecks(doc('Over 250k businesses — unlike LegalZoom, Wyoming is cheap.'), { bannedPhrases: ['legalzoom', '250k', 'cheap'], noEmDash: true }, { markers: [] })
  assert.match(nch.find((c) => c.id === 'banned-phrases')!.message, /legalzoom, 250k, cheap/)
  assert.equal(nch.find((c) => c.id === 'no-em-dash')!.ok, false)
})

test('checks: meta lengths, conclusion header words, NCH question H2s, format', () => {
  const out = doc('## What Is an LLC?\nx\n## Benefits of an LLC\n#### Deep\n<iframe src="x"></iframe>', {
    MAIN_CONTENT: '## What Is an LLC?\nx\n## Benefits of an LLC',
    VERDICT_SECTION: '## Is It Worth It?',
    CONCLUSION_HEADER: 'Done',
  }, { metaTitle: 'x'.repeat(61), metaDescription: 'ok' })
  const r = runChecks(out, { metaTitleMax: 60, metaDescriptionMax: 155, conclusionHeaderWords: { min: 3, max: 7 }, h2Questions: true }, { markers: ['META_TITLE', 'META_DESCRIPTION'] })
  const byId = Object.fromEntries(r.map((c) => [c.id, c]))
  assert.equal(byId['meta-title'].ok, false)
  assert.equal(byId['meta-description'].ok, true)
  assert.equal(byId['conclusion-header'].ok, false)
  assert.equal(byId['h2-questions'].message, 'H2s not phrased as questions: Benefits of an LLC')
  assert.equal(byId.format.ok, false)
  assert.match(byId.format.message, /headings below H3, raw HTML/)
})

test('retry instructions list each failed check', () => {
  const text = retryInstructions([{ id: 'a', ok: false, message: '3 H2 sections (expected 4–6)' }])
  assert.match(text, /failed these checks/)
  assert.match(text, /- 3 H2 sections \(expected 4–6\)$/)
})
