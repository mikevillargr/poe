// DR-020: "Show changes" for a draft-editing session: paragraph diff, with word-level marks inside edited
// paragraphs and long unchanged stretches folded. Pure (client + server).

import { diffLines, type DiffLine } from '@/lib/templates/diff'
import { htmlToText } from './text'

export type WordPart = { type: DiffLine['type']; text: string }
export type DraftHunk =
  | { type: 'same' | 'add' | 'remove'; text: string }
  | { type: 'edit'; parts: WordPart[] }
  | { type: 'skip'; count: number }

export function htmlToParagraphs(html: string | null | undefined): string[] {
  return htmlToText(html)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function diffWords(before: string, after: string): WordPart[] {
  const parts: WordPart[] = []
  for (const d of diffLines(before.split(' ').join('\n'), after.split(' ').join('\n'))) {
    const last = parts[parts.length - 1]
    if (last && last.type === d.type) last.text += ` ${d.text}`
    else parts.push({ type: d.type, text: d.text })
  }
  return parts
}

/** Paragraph hunks; `context` unchanged paragraphs are kept around each change, the rest fold into `skip`. */
export function draftDiff(beforeHtml: string, afterHtml: string, context = 1): DraftHunk[] {
  const lines = diffLines(htmlToParagraphs(beforeHtml).join('\n'), htmlToParagraphs(afterHtml).join('\n'))

  // Pair runs of removed + added paragraphs one-to-one as edits; leftovers stay whole.
  const hunks: DraftHunk[] = []
  for (let i = 0; i < lines.length; ) {
    if (lines[i]!.type === 'same') {
      hunks.push(lines[i++]!)
      continue
    }
    const removed: string[] = []
    const added: string[] = []
    while (i < lines.length && lines[i]!.type !== 'same') {
      const l = lines[i++]!
      ;(l.type === 'remove' ? removed : added).push(l.text)
    }
    const pairs = Math.min(removed.length, added.length)
    for (let k = 0; k < pairs; k++) hunks.push({ type: 'edit', parts: diffWords(removed[k]!, added[k]!) })
    for (const t of removed.slice(pairs)) hunks.push({ type: 'remove', text: t })
    for (const t of added.slice(pairs)) hunks.push({ type: 'add', text: t })
  }

  const keep = hunks.map((h) => h.type !== 'same')
  hunks.forEach((h, i) => {
    if (h.type === 'same') return
    for (let k = Math.max(0, i - context); k <= Math.min(hunks.length - 1, i + context); k++) keep[k] = true
  })
  const out: DraftHunk[] = []
  hunks.forEach((h, i) => {
    if (keep[i]) return out.push(h)
    const last = out[out.length - 1]
    if (last && last.type === 'skip') last.count++
    else out.push({ type: 'skip', count: 1 })
  })
  return out
}
