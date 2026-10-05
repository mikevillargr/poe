'use client'

import { useMemo, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { findTextRanges, scrollToFirstHighlight, setDecorations, suggestionHighlightKey } from '@/lib/tiptap/highlights'

/**
 * Editor API: the workspace ↔ optimize handshake (DR-005, INITIATIVE §3).
 *
 * The Article Workspace owns the TipTap editor and hands this object to the Optimize panel
 * (`<OptimizePanel articleId html editorApi />`, currently mounted as `OptimizeSlot`). Optimize
 * must go through it rather than touching TipTap directly.
 *
 * - `getHTML()`: the current draft HTML ('' while no editor is mounted, e.g. during generation).
 * - `setHTML(html)`: replaces the whole draft. Counts as a user edit, so it autosaves.
 * - `applySuggestion(original, replacement)`: finds the first case-insensitive occurrence of
 *   `original` (it may span bold/link marks within one block, not across blocks) and replaces it
 *   with `replacement` as plain text. Returns false if `original` isn't in the draft any more.
 *   Counts as a user edit (autosaves, undoable with Cmd+Z).
 * - `highlight(ranges, opts?)`: shows the in-text suggestion highlight (`.suggestion-highlight`,
 *   the same look as the old Analyze editor) on every occurrence of each `ranges[i].text`, and
 *   scrolls the first into view unless `opts.scroll === false`. `highlight([])` clears.
 *   Returns the number of matches. Highlights are decorations: never saved into the HTML.
 * - `isReady()`: false while no editable draft is mounted.
 */
export interface HighlightRange {
  text: string
  /** Rendered as data-suggestion-id on the highlight. */
  id?: string
}

export interface EditorApi {
  getHTML(): string
  setHTML(html: string): void
  applySuggestion(original: string, replacement: string): boolean
  highlight(ranges: HighlightRange[], opts?: { scroll?: boolean }): number
  isReady(): boolean
}

export function useEditorApi(editorRef: MutableRefObject<Editor | null>): EditorApi {
  return useMemo<EditorApi>(() => {
    const live = () => {
      const e = editorRef.current
      return e && !e.isDestroyed ? e : null
    }
    return {
      isReady: () => !!live()?.isEditable,
      getHTML: () => live()?.getHTML() ?? '',
      setHTML: (html) => {
        live()?.commands.setContent(html, true)
      },
      applySuggestion: (original, replacement) => {
        const editor = live()
        if (!editor || !original) return false
        const [first] = findTextRanges(editor.state.doc, original)
        if (!first) return false
        // deleteRange + insertContentAt(text) keeps the replacement as plain text (no HTML parsing),
        // exactly like the Analyze editor's Accept.
        editor
          .chain()
          .focus()
          .deleteRange(first)
          .insertContentAt(first.from, replacement ? { type: 'text', text: replacement } : [])
          .run()
        return true
      },
      highlight: (ranges, opts = {}) => {
        const editor = live()
        if (!editor) return 0
        const found = ranges.flatMap((r) =>
          findTextRanges(editor.state.doc, r.text).map((m) => ({
            ...m,
            attrs: { class: 'suggestion-highlight', ...(r.id ? { 'data-suggestion-id': r.id } : {}) },
          })),
        )
        setDecorations(editor, suggestionHighlightKey, found)
        if (found.length && opts.scroll !== false) scrollToFirstHighlight(editor)
        return found.length
      },
    }
  }, [editorRef])
}
