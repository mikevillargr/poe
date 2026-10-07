// DR-021: maps the rendered article's text (whitespace-collapsed, as in anchors) to DOM positions, so a
// selection can become an anchor and stored anchors can be highlighted. Browser-only.

import { locateAnchor, makeAnchor, type CommentAnchor } from './anchor'

export interface TextIndex {
  text: string
  /** For each character of `text`, the text node and offset it came from. */
  pos: { node: Text; offset: number }[]
}

export function buildTextIndex(root: Node): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let text = ''
  const pos: TextIndex['pos'] = []
  let lastSpace = true
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const s = n.data
    for (let i = 0; i < s.length; i++) {
      const space = /\s/.test(s[i]!)
      if (space && lastSpace) continue
      text += space ? ' ' : s[i]
      pos.push({ node: n, offset: i })
      lastSpace = space
    }
  }
  return { text, pos }
}

/** The first index whose character is at or after the boundary point (node, offset): works for text and element boundaries. */
function indexOf(idx: TextIndex, node: Node, offset: number): number {
  const boundary = document.createRange()
  boundary.setStart(node, offset)
  for (let i = 0; i < idx.pos.length; i++) {
    const p = idx.pos[i]!
    if (boundary.comparePoint(p.node, p.offset) >= 0) return i
  }
  return idx.pos.length
}

/** An anchor for the current selection inside `root`, or null when nothing (or only whitespace) is selected. */
export function anchorFromSelection(root: HTMLElement): CommentAnchor | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  const idx = buildTextIndex(root)
  const start = indexOf(idx, range.startContainer, range.startOffset)
  const end = indexOf(idx, range.endContainer, range.endOffset)
  if (end <= start) return null
  const a = makeAnchor(idx.text, start, end)
  return a.quote ? a : null
}

/** A DOM Range for an anchor in `root`, or null when its text is gone. */
export function rangeForAnchor(idx: TextIndex, a: CommentAnchor): Range | null {
  const hit = locateAnchor(idx.text, a)
  if (!hit || hit.end <= hit.start) return null
  const s = idx.pos[hit.start]
  const e = idx.pos[hit.end - 1]
  if (!s || !e) return null
  const r = document.createRange()
  r.setStart(s.node, s.offset)
  r.setEnd(e.node, e.offset + 1)
  return r
}

/** The text index position under a viewport point, or -1. */
export function indexAtPoint(idx: TextIndex, x: number, y: number): number {
  const doc = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null }
  let node: Node | null = null
  let offset = 0
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y)
    if (p) ({ offsetNode: node, offset } = p)
  } else if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y)
    if (r) ({ startContainer: node, startOffset: offset } = r)
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return -1
  return idx.pos.findIndex((p) => p.node === node && p.offset >= offset)
}

export function highlightsSupported(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof (globalThis as { Highlight?: unknown }).Highlight === 'function'
}

/** Paints comment highlights (CSS Custom Highlight API): all threads, and the active one stronger. */
export function paintHighlights(ranges: Range[], active: Range | null) {
  if (!highlightsSupported()) return
  const H = (globalThis as unknown as { Highlight: new (...r: Range[]) => unknown }).Highlight
  const reg = (CSS as unknown as { highlights: Map<string, unknown> }).highlights
  reg.set('poe-comment', new H(...ranges))
  if (active) reg.set('poe-comment-active', new H(active))
  else reg.delete('poe-comment-active')
}
