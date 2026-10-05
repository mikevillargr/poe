// Decoration-based highlighting for the TipTap editor (owned by WS workspace).
// Decorations, not marks: they never end up in the saved HTML.
import { Extension, type Editor } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface TextRange {
  from: number
  to: number
}

function decorationPlugin(key: PluginKey<DecorationSet>) {
  return new Plugin<DecorationSet>({
    key,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(key)
        if (meta !== undefined) return meta as DecorationSet
        return old.map(tr.mapping, tr.doc)
      },
    },
    props: {
      decorations(state) {
        return key.getState(state)
      },
    },
  })
}

/** Suggestion highlights (the `.suggestion-highlight` style from globals.css). */
export const suggestionHighlightKey = new PluginKey<DecorationSet>('suggestionHighlight')
/** SEO keyword highlights (the "Highlight keywords" toggle). */
export const keywordHighlightKey = new PluginKey<DecorationSet>('keywordHighlight')

export const SuggestionHighlightExtension = Extension.create({
  name: 'suggestionHighlight',
  addProseMirrorPlugins() {
    return [decorationPlugin(suggestionHighlightKey)]
  },
})

export const KeywordHighlightExtension = Extension.create({
  name: 'keywordHighlight',
  addProseMirrorPlugins() {
    return [decorationPlugin(keywordHighlightKey)]
  },
})

/**
 * Every case-insensitive occurrence of `search` in the document. Matches may span marks (bold,
 * links…) inside one paragraph/heading/list item, but not across blocks.
 */
export function findTextRanges(doc: PMNode, search: string, opts: { wholeWord?: boolean } = {}): TextRange[] {
  const needle = search.trim().toLowerCase()
  if (!needle) return []
  const out: TextRange[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    let text = ''
    const map: number[] = []
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + offset + i)
        text += child.text
      } else {
        map.push(pos + 1 + offset)
        text += '￼'
      }
    })
    const lower = text.toLowerCase()
    let idx = lower.indexOf(needle)
    while (idx !== -1) {
      const end = idx + needle.length
      const ok =
        !opts.wholeWord || (!/[\p{L}\p{N}]/u.test(lower[idx - 1] ?? '') && !/[\p{L}\p{N}]/u.test(lower[end] ?? ''))
      if (ok) out.push({ from: map[idx], to: map[end - 1] + 1 })
      idx = lower.indexOf(needle, idx + 1)
    }
    return false
  })
  return out
}

export function setDecorations(
  editor: Editor,
  key: PluginKey<DecorationSet>,
  ranges: Array<TextRange & { attrs?: Record<string, string> }>,
) {
  if (editor.isDestroyed) return
  const { state, view } = editor
  const set = ranges.length
    ? DecorationSet.create(
        state.doc,
        ranges.map((r) => Decoration.inline(r.from, r.to, r.attrs ?? {})),
      )
    : DecorationSet.empty
  view.dispatch(state.tr.setMeta(key, set).setMeta('addToHistory', false))
}

/** Scrolls the first `.suggestion-highlight` into view (as the old EditorView did on card click). */
export function scrollToFirstHighlight(editor: Editor, selector = '.suggestion-highlight') {
  setTimeout(() => {
    if (editor.isDestroyed) return
    editor.view.dom.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 50)
}
