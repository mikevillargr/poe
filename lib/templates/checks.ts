// Output checks (doc: "Output checks"). n8n queued whatever the model returned; Poe tests every result,
// retries once with the failures added to the prompt, and otherwise saves it flagged for review.

import { countWords } from '@/lib/articles/text'
import { containsWholeWord } from './detect'
import { markdownToHtml } from './markdown'
import { extractUrls, urlKey } from './selector'
import type { AssembledOutput, CheckConfig, CheckResult, Range } from './types'

export interface CheckContext {
  /** The template's markers (required ones default to all of them). */
  markers: string[]
  /** Word range sent in the prompt. */
  wordRange?: Range | null
  /** Every URL the writer was given: selected links, directory links, YouTube, CTA targets. */
  suppliedUrls?: string[]
  /** CTA targets: not counted as internal links. */
  ctaUrls?: string[]
  /** Lead-in phrases banned right before a link. Defaults to DEFAULT_LEAD_INS. */
  leadIns?: string[]
}

export const DEFAULT_LEAD_INS = ['check out', 'click here', 'learn more about', 'read our guide on']

const META_LINE = /^\*\*(Meta Title|Meta Description|Blog Summary):\*\*/i
const LINK = /\[([^\]]+)\]\(\s*<?([^)\s>]+)>?\s*\)/g

const headings = (md: string, level: number) =>
  md.split('\n').filter((l) => new RegExp(`^#{${level}}\\s`).test(l) && !new RegExp(`^#{${level + 1}}`).test(l))

const listItems = (md: string) => md.split('\n').filter((l) => /^\s*([-*•]|\d+[.)])\s+\S/.test(l)).length

const inRange = (n: number, r: Partial<Range>) => (r.min === undefined || n >= r.min) && (r.max === undefined || n <= r.max)

const rangeText = (r: Partial<Range>) =>
  r.min !== undefined && r.max !== undefined ? (r.min === r.max ? `${r.min}` : `${r.min}–${r.max}`) : r.min !== undefined ? `at least ${r.min}` : `at most ${r.max}`

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim())
}

export function bodyWordCount(markdown: string): number {
  const body = markdown
    .split('\n')
    .filter((l) => !META_LINE.test(l.trim()))
    .join('\n')
  return countWords(markdownToHtml(body))
}

export function runChecks(out: AssembledOutput, config: CheckConfig, ctx: CheckContext): CheckResult[] {
  const md = out.markdown
  const results: CheckResult[] = []
  const add = (id: string, ok: boolean, message: string) => results.push({ id, ok, message })
  const scope = (section?: string) => (section ? (out.sections[section] ?? '') : md)
  const main = out.sections.MAIN_CONTENT !== undefined ? out.sections.MAIN_CONTENT : md

  // Markers
  const required = config.requiredMarkers ?? ctx.markers
  const emptyMarkers = required.filter((m) => !(out.sections[m] ?? '').trim())
  if (required.length) add('markers', !emptyMarkers.length, emptyMarkers.length ? `Missing or empty sections: ${emptyMarkers.join(', ')}` : 'All sections present')

  // Word count
  if (ctx.wordRange) {
    const t = config.wordCountTolerance ?? 0
    const r = { min: Math.floor(ctx.wordRange.min * (1 - t)), max: Math.ceil(ctx.wordRange.max * (1 + t)) }
    const n = bodyWordCount(md)
    add('word-count', inRange(n, r), `${n} words (target ${rangeText(r)})`)
  }

  // Heading counts (blogs count inside MAIN_CONTENT)
  if (config.h2) {
    const n = headings(main, 2).length
    add('h2-count', inRange(n, config.h2), `${n} H2 sections (expected ${rangeText(config.h2)})`)
  }
  if (config.h3) {
    const n = headings(main, 3).length
    add('h3-count', inRange(n, config.h3), `${n} H3 headings (expected ${rangeText(config.h3)})`)
  }
  if (config.questions) {
    const q = config.questions
    const n = headings(scope(q.section), q.level).length
    add('question-count', inRange(n, q), `${n} questions (expected ${rangeText(q)})`)
  }
  for (const l of config.lists ?? []) {
    const n = listItems(scope(l.section))
    add(`list-${l.section.toLowerCase()}`, inRange(n, l), `${l.label}: ${n} items (expected ${rangeText(l)})`)
  }

  // Links
  const links = [...md.matchAll(LINK)].map((m) => ({ text: m[1], url: m[2] }))
  const cta = new Set((ctx.ctaUrls ?? []).map(urlKey))
  if (config.links) {
    const n = links.filter((l) => !cta.has(urlKey(l.url))).length
    add('link-count', inRange(n, config.links), `${n} ${config.links.label ?? 'internal links'} (expected ${rangeText(config.links)})`)
  }
  if (config.onlySuppliedUrls) {
    const allowed = new Set([...(ctx.suppliedUrls ?? []), ...(ctx.ctaUrls ?? [])].flatMap(extractUrls).map(urlKey))
    const bare = md.split('\n').flatMap((l) => (/^\s*<?https?:\/\/\S+>?\s*$/.test(l) ? extractUrls(l) : []))
    const foreign = [...links.map((l) => l.url), ...bare].filter((u) => /^https?:/i.test(u) && !allowed.has(urlKey(u)))
    add('supplied-urls', !foreign.length, foreign.length ? `Links not in the supplied list: ${foreign.join(', ')}` : 'Only supplied URLs linked')
  }
  const linkedHeadings = md.split('\n').filter((l) => /^#{1,6}\s/.test(l) && /\[[^\]]+\]\([^)]+\)/.test(l))
  add('no-heading-links', !linkedHeadings.length, linkedHeadings.length ? `Links inside headings: ${linkedHeadings.length}` : 'No links in headings')
  const leadIns = (ctx.leadIns ?? DEFAULT_LEAD_INS).filter((p) =>
    new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(\\s+\\S+){0,4}?\\s*\\[`, 'i').test(md),
  )
  add('no-lead-ins', !leadIns.length, leadIns.length ? `Lead-in phrases before links: ${leadIns.join(', ')}` : 'No lead-in phrases')

  // Banned strings
  const banned = (config.bannedPhrases ?? []).filter((p) => containsWholeWord(md, p))
  if (config.bannedPhrases?.length) add('banned-phrases', !banned.length, banned.length ? `Banned phrases used: ${banned.join(', ')}` : 'No banned phrases')
  if (config.noEmDash) {
    const n = (md.match(/—/g) ?? []).length
    add('no-em-dash', n === 0, n ? `${n} em dashes` : 'No em dashes')
  }
  for (const rule of config.proximity ?? []) {
    const bad = sentences(md).filter(
      (s) => rule.terms.some((t) => containsWholeWord(s, t)) && !rule.allowedWith.some((a) => containsWholeWord(s, a)),
    )
    add(`proximity-${rule.label}`, !bad.length, bad.length ? `${rule.label}: used without an allowed brand in "${bad[0].trim().slice(0, 120)}"` : `${rule.label}: OK`)
  }

  // Meta
  if (config.metaTitleMax && ctx.markers.includes('META_TITLE')) {
    const n = (out.metaTitle ?? '').length
    add('meta-title', n > 0 && n <= config.metaTitleMax, `Meta title ${n} characters (max ${config.metaTitleMax})`)
  }
  if (config.metaDescriptionMax && ctx.markers.includes('META_DESCRIPTION')) {
    const n = (out.metaDescription ?? '').length
    add('meta-description', n > 0 && n <= config.metaDescriptionMax, `Meta description ${n} characters (max ${config.metaDescriptionMax})`)
  }
  if (config.conclusionHeaderWords) {
    const n = (out.sections.CONCLUSION_HEADER ?? '').split(/\s+/).filter(Boolean).length
    add('conclusion-header', inRange(n, config.conclusionHeaderWords), `Conclusion header ${n} words (expected ${rangeText(config.conclusionHeaderWords)})`)
  }
  if (config.h2Questions) {
    const scoped = [out.sections.MAIN_CONTENT ?? md, out.sections.VERDICT_SECTION ?? ''].join('\n')
    const notQuestions = headings(scoped, 2).filter((h) => !h.trim().endsWith('?'))
    add('h2-questions', !notQuestions.length, notQuestions.length ? `H2s not phrased as questions: ${notQuestions.map((h) => h.replace(/^##\s*/, '')).join(' | ')}` : 'Every H2 is a question')
  }

  // Format (all templates)
  const deep = md.split('\n').filter((l) => /^#{4,}\s/.test(l)).length
  const html = /<\/?(iframe|div|span|script|p|br|h\d)\b/i.test(md)
  const hr = md.split('\n').some((l) => /^\s*-{3,}\s*$/.test(l))
  add('format', !deep && !html && !hr, [deep && `${deep} headings below H3`, html && 'raw HTML', hr && 'horizontal rules'].filter(Boolean).join(', ') || 'Format OK')

  return results
}

export const failedChecks = (results: CheckResult[]) => results.filter((r) => !r.ok)

/** Appended to the writer prompt for the single retry. */
export function retryInstructions(failed: CheckResult[]): string {
  return [
    '',
    'IMPORTANT: A previous attempt at this task failed these checks. Fix every one of them in this attempt, and keep following all of the instructions above:',
    ...failed.map((f) => `- ${f.message}`),
  ].join('\n')
}
