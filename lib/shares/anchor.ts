// DR-021: where a passage comment points in the article. A comment stores the quoted text plus a little
// context on each side; on every view we look for it again, so edits around it don't lose the thread. If the
// quote itself was edited away, the thread is "on text that has since changed" (still shown, never lost).
// Pure (client + server).

import type { CommentAnchor } from '@/lib/db/schema/sharing'

export type { CommentAnchor }

export const ANCHOR_CONTEXT = 32
export const ANCHOR_MAX_QUOTE = 1000

const norm = (s: string) => s.replace(/\s+/g, ' ')

/** Builds an anchor for `text.slice(start, end)`. */
export function makeAnchor(text: string, start: number, end: number): CommentAnchor {
  return {
    quote: norm(text.slice(start, end)).trim().slice(0, ANCHOR_MAX_QUOTE),
    prefix: norm(text.slice(Math.max(0, start - ANCHOR_CONTEXT), start)),
    suffix: norm(text.slice(end, end + ANCHOR_CONTEXT)),
  }
}

/**
 * Finds the anchor in `text` (whitespace-insensitive). With several matches, the one whose surrounding text
 * best matches the stored prefix/suffix wins. Returns offsets in the whitespace-normalized text, or null.
 */
export function locateAnchor(text: string, a: CommentAnchor): { start: number; end: number } | null {
  const t = norm(text)
  const q = a.quote.trim()
  if (!q) return null
  let best: { start: number; end: number; score: number } | null = null
  for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
    const before = t.slice(Math.max(0, i - a.prefix.length), i)
    const after = t.slice(i + q.length, i + q.length + a.suffix.length)
    const score = commonSuffix(before, a.prefix) + commonPrefix(after, a.suffix)
    if (!best || score > best.score) best = { start: i, end: i + q.length, score }
  }
  return best ? { start: best.start, end: best.end } : null
}

function commonPrefix(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

function commonSuffix(a: string, b: string) {
  let n = 0
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++
  return n
}
