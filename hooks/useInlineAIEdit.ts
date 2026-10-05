'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { DOMParser as PMDOMParser } from '@tiptap/pm/model'
import { Selection } from '@tiptap/pm/state'
import { useAIStream } from '@/lib/ai/client/useAIStream'
import type { AIStreamEvent } from '@/lib/ai/types'
import { useToast } from '@/hooks/useToast'
import { aiEditReducer, CLOSED, canAccept, type AiEditMode } from '@/lib/ai-edit/state'
import { DEFAULT_INSERT_INSTRUCTION, clipContext, plainToHtml, unwrapInline } from '@/lib/ai-edit/text'
import { AI_EDIT_LIMITS, type AiEditPreset } from '@/lib/prompts/ai-edit-presets'
import { aiEditKey, getAiRange, isEmptyParagraphSelection, setAiRange } from '@/lib/tiptap/ai-edit'

export interface SelectionInfo {
  /** A non-empty text selection (not just whitespace). */
  hasSelection: boolean
  /** The selection spans more than one block: v1 can't improve it. */
  multiBlock: boolean
  emptyLine: boolean
}

const NO_SELECTION: SelectionInfo = { hasSelection: false, multiBlock: false, emptyLine: false }

export function readSelection(editor: Editor | null): SelectionInfo {
  if (!editor || editor.isDestroyed) return NO_SELECTION
  const { selection, doc } = editor.state
  const hasSelection = !selection.empty && doc.textBetween(selection.from, selection.to, '\n').trim().length > 0
  return { hasSelection, multiBlock: hasSelection && !selection.$from.sameParent(selection.$to), emptyLine: isEmptyParagraphSelection(editor) }
}

/**
 * Inline AI edit (DR-009 decisions 2 and 3): rewrite the selection, or write new text on an empty line.
 * One hook for both modes. The document is only touched by accept(), as a single undo step.
 */
export function useInlineAIEdit(editor: Editor | null, url: string | undefined) {
  const { toast } = useToast()
  const [state, dispatch] = useReducer(aiEditReducer, CLOSED)
  const stateRef = useRef(state)
  stateRef.current = state
  const [selection, setSelection] = useState<SelectionInfo>(NO_SELECTION)

  const onEvent = useCallback((ev: AIStreamEvent) => {
    const r = ev as unknown as { type: string; html?: string; warnings?: string[] }
    if (r.type === 'result') dispatch({ type: 'result', html: r.html ?? '', warnings: r.warnings ?? [] })
  }, [])
  const stream = useAIStream({ onEvent })

  // Stream outcomes that don't carry a result.
  useEffect(() => {
    if (stateRef.current.phase !== 'streaming') return
    if (stream.status === 'error') {
      const message =
        stream.error?.code === 'NETWORK_ERROR' ? 'Could not reach the server. Check your connection and try again.' : (stream.error?.message ?? 'The request failed.')
      dispatch({ type: 'fail', message })
      toast.error('AI edit failed', message)
    } else if (stream.status === 'aborted') dispatch({ type: 'stopped' })
    else if (stream.status === 'done') {
      dispatch({ type: 'fail', message: 'The model returned nothing to apply.' })
      toast.error('AI edit failed', 'The model returned nothing to apply.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.status])

  // Selection tracking for the toolbar button, the bubble and the mobile chip.
  useEffect(() => {
    if (!editor) return
    const update = () => {
      const next = readSelection(editor)
      setSelection((p) => (p.hasSelection === next.hasSelection && p.multiBlock === next.multiBlock && p.emptyLine === next.emptyLine ? p : next))
    }
    editor.on('selectionUpdate', update)
    editor.on('update', update)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('update', update)
    }
  }, [editor])

  /** Is the tracked target still where we left it? Never apply to a mismatched range. */
  const targetValid = useCallback((): boolean => {
    if (!editor || editor.isDestroyed) return false
    const range = getAiRange(editor)
    const s = stateRef.current
    if (!range || (range.kind !== s.mode)) return false
    if (range.to > editor.state.doc.content.size) return false
    if (s.mode === 'rewrite') return range.to > range.from && editor.state.doc.textBetween(range.from, range.to, '\n') === s.original
    const node = editor.state.doc.nodeAt(range.from)
    return !!node && node.type.name === 'paragraph' && node.content.size === 0
  }, [editor])

  // Selection mapping while streaming: if the range can no longer be located, show the stale state.
  useEffect(() => {
    if (!editor) return
    const check = () => {
      if (stateRef.current.phase === 'closed' || stateRef.current.phase === 'stale') return
      if (!getAiRange(editor) || !targetValid()) dispatch({ type: 'stale' })
    }
    editor.on('transaction', check)
    return () => {
      editor.off('transaction', check)
    }
  }, [editor, targetValid])

  const close = useCallback(() => {
    stream.abort()
    dispatch({ type: 'close' })
    if (editor && !editor.isDestroyed) {
      if (getAiRange(editor)?.kind !== 'flash') setAiRange(editor, null)
      editor.commands.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  /** Opens the prompt for the current selection (rewrite) or empty line (insert). */
  const open = useCallback(
    (mode?: AiEditMode): boolean => {
      if (!editor || editor.isDestroyed || !url || !editor.isEditable) return false
      if (stateRef.current.phase === 'streaming') return true
      const info = readSelection(editor)
      const want = mode ?? (info.hasSelection ? 'rewrite' : info.emptyLine ? 'insert' : null)
      if (want === 'rewrite') {
        if (!info.hasSelection) {
          toast.info('Select some text first', 'Select text inside a paragraph, then press ⌘J.')
          return true
        }
        if (info.multiBlock) {
          toast.info('Select text within one paragraph', 'Improve works on a single paragraph at a time.')
          return true
        }
        const { from, to } = editor.state.selection
        const original = editor.state.doc.textBetween(from, to, '\n')
        if (original.length > AI_EDIT_LIMITS.selectedText) {
          toast.info('That selection is too long', `Select up to ${AI_EDIT_LIMITS.selectedText.toLocaleString('en-US')} characters.`)
          return true
        }
        setAiRange(editor, { from, to, kind: 'rewrite' })
        dispatch({ type: 'open', mode: 'rewrite', original })
        return true
      }
      if (want === 'insert') {
        if (!info.emptyLine) {
          toast.info('Move to an empty line', 'Writing with AI needs an empty paragraph to write into.')
          return true
        }
        const $from = editor.state.selection.$from
        setAiRange(editor, { from: $from.before(), to: $from.after(), kind: 'insert' })
        dispatch({ type: 'open', mode: 'insert', original: '' })
        return true
      }
      toast.info('Select text to improve it', 'Or move to an empty line and press ⌘J to write new text with AI.')
      return true
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, url],
  )

  const run = useCallback(
    (preset: AiEditPreset | null, instruction: string) => {
      const s = stateRef.current
      if (!editor || !url || (s.phase !== 'prompt' && s.phase !== 'error' && s.phase !== 'preview')) return
      const range = getAiRange(editor)
      if (!range || !targetValid()) {
        dispatch({ type: 'stale' })
        return
      }
      const doc = editor.state.doc
      const { contextBefore, contextAfter } = clipContext(
        doc.textBetween(0, range.from, '\n\n', ' '),
        doc.textBetween(range.to, doc.content.size, '\n\n', ' '),
      )
      const text = instruction.trim()
      const body =
        s.mode === 'rewrite'
          ? { mode: 'rewrite', selectedText: s.original, preset: preset ?? 'custom', instruction: text, contextBefore, contextAfter }
          : { mode: 'insert', instruction: text || DEFAULT_INSERT_INSTRUCTION, contextBefore, contextAfter }
      dispatch({ type: 'run', preset, instruction: text })
      void stream.start(url, body)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, url, targetValid],
  )

  const stop = useCallback(() => stream.abort(), [stream])
  const adjust = useCallback(() => dispatch({ type: 'adjust' }), [])

  /** Applies the preview to the document in ONE transaction (one Cmd+Z). `editedText` = text the user changed by hand. */
  const accept = useCallback(
    (editedText?: string): boolean => {
      const s = stateRef.current
      if (!editor || editor.isDestroyed || !canAccept(s) || !targetValid()) {
        if (s.phase !== 'closed') dispatch({ type: 'stale' })
        return false
      }
      const range = getAiRange(editor)!
      const html =
        editedText !== undefined ? plainToHtml(editedText, s.mode === 'rewrite') : s.mode === 'rewrite' ? unwrapInline(s.html) : s.html
      const el = document.createElement('div')
      el.innerHTML = html
      const parser = PMDOMParser.fromSchema(editor.schema)
      const { tr } = editor.state
      if (s.mode === 'rewrite') {
        tr.replaceRange(range.from, range.to, parser.parseSlice(el))
      } else {
        const frag = parser.parse(el).content
        tr.replaceWith(range.from, range.to, frag.size ? frag : editor.schema.nodes.paragraph.create())
      }
      const end = Math.min(tr.mapping.map(range.to, 1), tr.doc.content.size)
      tr.setSelection(Selection.near(tr.doc.resolve(end), -1))
      tr.setMeta(aiEditKey, end > range.from ? { type: 'set', range: { from: range.from, to: end, kind: 'flash' } } : { type: 'clear' })
      editor.view.dispatch(tr.scrollIntoView())
      dispatch({ type: 'close' })
      editor.commands.focus()
      setTimeout(() => {
        if (!editor.isDestroyed && getAiRange(editor)?.kind === 'flash') setAiRange(editor, null)
      }, 1600)
      return true
    },
    [editor, targetValid],
  )

  return { state, streamText: stream.text, selection, open, run, stop, adjust, accept, close }
}

export type InlineAIEdit = ReturnType<typeof useInlineAIEdit>
