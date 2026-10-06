'use client'

import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent, BubbleMenu, FloatingMenu, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import UnderlineExtension from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { tableExtensions } from '@/lib/tiptap/table'
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Trash2,
  Link2,
  Sparkles,
} from 'lucide-react'
import { countWords } from '@/lib/articles/text'
import {
  KeywordHighlightExtension,
  SuggestionHighlightExtension,
  findTextRanges,
  keywordHighlightKey,
  scrollToFirstHighlight,
  setDecorations,
  suggestionHighlightKey,
} from '@/lib/tiptap/highlights'
import { AiEditExtension, type AiEditTriggers } from '@/lib/tiptap/ai-edit'
import { useInlineAIEdit } from '@/hooks/useInlineAIEdit'
import { InlineAIPrompt } from './InlineAIPrompt'

// The Poe editor (owned by WS workspace). Retooled from the Analyze editor: same toolbar, autosave,
// and in-text suggestion highlighting; adds H3, real save status, actual/target word count, keyword
// highlighting and a toolbar slot for host actions.

interface RichTextEditorProps {
  content?: string
  suggestions?: Array<{
    id: string
    original: string
    severity: 'high' | 'medium' | 'low'
    category?: string
    charStart?: number
    charEnd?: number
  }>
  placeholder?: string
  /** Autosave target. If it returns a promise, the save status follows it (rejection → "Not saved"). */
  onSave?: (content: string) => void | Promise<unknown>
  autoSaveDelay?: number
  activeSuggestionId?: string | null
  onSuggestionClick?: (id: string) => void
  onContentChange?: (content: string, wordCount: number, charCount: number) => void
  editorRef?: React.MutableRefObject<any>
  onDelete?: () => void
  /** Shows "actual / target words" in the status bar. */
  targetWords?: number | null
  /** Keywords to highlight while `highlightKeywords` is on (first = primary). */
  keywords?: string[]
  highlightKeywords?: boolean
  /** Extra controls rendered at the right of the toolbar (Save version, Versions, …). */
  toolbarExtra?: React.ReactNode
  onReady?: (editor: Editor) => void
  /** POST endpoint for inline AI edits (…/ai-edit). Omit to turn Improve / Write with AI off. */
  aiEditUrl?: string
  /** Rendered between the toolbar and the editing canvas (e.g. the Revise panel). */
  aboveContent?: React.ReactNode
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

const nf = new Intl.NumberFormat('en-US')

const KEYWORD_STYLE = {
  primary: 'background-color: rgba(30, 64, 175, 0.16); border-bottom: 2px solid rgba(30, 64, 175, 0.75); border-radius: 2px;',
  secondary: 'background-color: rgba(30, 64, 175, 0.08); border-bottom: 2px dotted rgba(30, 64, 175, 0.55); border-radius: 2px;',
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded transition-colors disabled:opacity-50 ${
        active ? 'bg-accent text-white' : 'text-muted hover:text-heading hover:bg-surface-hover'
      }`}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

const Divider = () => <div className="w-px h-6 bg-border mx-1" />

export function RichTextEditor({
  content = '',
  suggestions,
  placeholder = 'Start writing or paste your content here...',
  onSave,
  autoSaveDelay = 2000,
  activeSuggestionId,
  onContentChange,
  editorRef,
  onDelete,
  targetWords,
  keywords,
  highlightKeywords = false,
  toolbarExtra,
  onReady,
  aiEditUrl,
  aboveContent,
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [wordCount, setWordCount] = useState(() => countWords(content))
  const prevSuggestionRef = useRef<string | null | undefined>(null)
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const onContentChangeRef = useRef(onContentChange)
  onContentChangeRef.current = onContentChange
  const triggersRef = useRef<AiEditTriggers | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        paragraph: { HTMLAttributes: { class: 'mb-4' } },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount.configure({ limit: null }),
      UnderlineExtension,
      ...tableExtensions,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-accent underline cursor-pointer' },
      }),
      SuggestionHighlightExtension,
      KeywordHighlightExtension,
      AiEditExtension.configure({ triggers: () => triggersRef.current }),
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-6 py-4',
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved')
      const html = editor.getHTML()
      const words = countWords(html)
      setWordCount(words)
      onContentChangeRef.current?.(html, words, editor.storage.characterCount.characters())
    },
  })

  // Inline AI edit (DR-009): ⌘J / "/" on an empty line / the bubble button all go through this.
  const ai = useInlineAIEdit(editor, aiEditUrl)
  triggersRef.current = aiEditUrl ? { onShortcut: () => ai.open(), onSlash: () => ai.open('insert') } : null
  const aiBusy = ai.state.phase !== 'closed'
  const canImprove = !!aiEditUrl && !aiBusy && ((ai.selection.hasSelection && !ai.selection.multiBlock) || ai.selection.emptyLine)

  // Expose the editor instance to the host.
  useEffect(() => {
    if (!editor) return
    if (editorRef) editorRef.current = editor
    onReady?.(editor)
    return () => {
      if (editorRef?.current === editor) editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor])

  // Highlight the active suggestion (unchanged behaviour from the Analyze editor).
  useEffect(() => {
    if (!editor || !editor.view || !editor.isEditable) return
    if (prevSuggestionRef.current === activeSuggestionId) return
    const timer = setTimeout(() => {
      if (!editor || editor.isDestroyed) return
      prevSuggestionRef.current = activeSuggestionId
      const suggestion = activeSuggestionId ? suggestions?.find((s) => s.id === activeSuggestionId) : undefined
      if (!suggestion?.original) {
        setDecorations(editor, suggestionHighlightKey, [])
        return
      }
      const ranges = findTextRanges(editor.state.doc, suggestion.original)
      setDecorations(
        editor,
        suggestionHighlightKey,
        ranges.map((r) => ({ ...r, attrs: { class: 'suggestion-highlight', 'data-suggestion-id': suggestion.id } })),
      )
      if (ranges.length) scrollToFirstHighlight(editor)
    }, 10)
    return () => clearTimeout(timer)
  }, [activeSuggestionId, editor, suggestions])

  // Keyword highlighting: recomputed on toggle, keyword change and (debounced) edits.
  const keywordKey = (keywords ?? []).join('\u0001')
  const [docVersion, setDocVersion] = useState(0)
  useEffect(() => {
    if (!editor || !highlightKeywords) return
    let t: ReturnType<typeof setTimeout>
    const onUpdate = () => {
      clearTimeout(t)
      t = setTimeout(() => setDocVersion((v) => v + 1), 400)
    }
    editor.on('update', onUpdate)
    return () => {
      clearTimeout(t)
      editor.off('update', onUpdate)
    }
  }, [editor, highlightKeywords])
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const list = highlightKeywords ? (keywords ?? []).filter((k) => k.trim()) : []
    const ranges = list.flatMap((k, i) =>
      findTextRanges(editor.state.doc, k, { wholeWord: true }).map((r) => ({
        ...r,
        attrs: { style: i === 0 ? KEYWORD_STYLE.primary : KEYWORD_STYLE.secondary, 'data-keyword': k },
      })),
    )
    setDecorations(editor, keywordHighlightKey, ranges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, highlightKeywords, keywordKey, docVersion])

  const runSave = useCallback(async () => {
    if (!editor || !onSaveRef.current) return
    setSaveStatus('saving')
    try {
      await onSaveRef.current(editor.getHTML())
      // Edits made while saving keep the status "unsaved" (the next autosave picks them up).
      setSaveStatus((s) => (s === 'saving' ? 'saved' : s))
    } catch {
      setSaveStatus('error')
    }
  }, [editor])

  // Debounced autosave.
  useEffect(() => {
    if (!editor || saveStatus !== 'unsaved') return
    const timer = setTimeout(runSave, autoSaveDelay)
    return () => clearTimeout(timer)
  }, [editor, saveStatus, runSave, autoSaveDelay])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        runSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [runSave])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading editor...</div>
      </div>
    )
  }

  const characterCount = editor.storage.characterCount.characters()
  const ratio = targetWords ? wordCount / targetWords : 0
  const onTarget = ratio >= 0.9 && ratio <= 1.1

  return (
    <div className="flex flex-col h-full relative [&_.ai-edit-range]:bg-accent/15 [&_.ai-edit-range]:rounded-sm [&_.ai-edit-range]:border-b-2 [&_.ai-edit-range]:border-dotted [&_.ai-edit-range]:border-accent [&_.ai-edit-insert-anchor]:bg-success/10 [&_.ai-edit-insert-anchor]:rounded [&_.ai-edit-flash]:bg-success/25 [&_.ai-edit-flash]:rounded-sm">
      {/* Formatting Toolbar */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-4 py-2 flex items-center gap-1 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Cmd+U)"
        >
          <Underline className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
          title="Add Link"
        >
          <Link2 className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo (Cmd+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        {aiEditUrl && (
          <>
            <Divider />
            <button
              type="button"
              onClick={() => ai.open()}
              disabled={!canImprove}
              title={
                ai.selection.multiBlock
                  ? 'Select text within one paragraph to improve it'
                  : 'Improve the selected text with AI, or write on an empty line (⌘J)'
              }
              aria-label="Improve with AI"
              className="px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Sparkles className="w-3.5 h-3.5" /> Improve
            </button>
          </>
        )}

        {onDelete && (
          <>
            <Divider />
            <button
              type="button"
              onClick={onDelete}
              className="p-2 rounded transition-colors text-muted hover:text-danger hover:bg-danger/10"
              title="Delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="flex-1" />

        {toolbarExtra}

        {onSave && (
          <button
            type="button"
            onClick={runSave}
            disabled={saveStatus === 'saving'}
            className="px-3 py-2 rounded transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            title="Save now (Cmd+S)"
          >
            {saveStatus === 'saved' && <span className="text-success">Saved</span>}
            {saveStatus === 'saving' && <span className="text-accent">Saving...</span>}
            {saveStatus === 'unsaved' && <span className="text-warning">Unsaved changes</span>}
            {saveStatus === 'error' && <span className="text-red-400">Not saved · Retry</span>}
          </button>
        )}
      </div>

      {aboveContent}

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>

      {aiEditUrl && (
        <>
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'top', maxWidth: 'none' }}
            shouldShow={({ view, state, from, to }) =>
              typeof window !== 'undefined' &&
              window.innerWidth >= 768 &&
              view.hasFocus() &&
              !state.selection.empty &&
              state.doc.textBetween(from, to, ' ').trim().length > 0 &&
              editor.isEditable &&
              ai.state.phase === 'closed'
            }
          >
            {ai.selection.multiBlock ? (
              <span title="Select text within one paragraph to improve it">
                <button
                  type="button"
                  disabled
                  className="glass-card shadow-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 text-muted opacity-70 cursor-not-allowed"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Improve
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => ai.open('rewrite')}
                title="Improve the selected text with AI (⌘J)"
                className="glass-card shadow-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 text-accent hover:bg-accent/10 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Improve
                <kbd className="font-mono text-[10px] text-muted">⌘J</kbd>
              </button>
            )}
          </BubbleMenu>
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'right', offset: [0, 12], maxWidth: 'none' }}
            shouldShow={({ view, state }) => {
              const { $from } = state.selection
              return (
                view.hasFocus() &&
                state.selection.empty &&
                $from.depth === 1 &&
                $from.parent.type.name === 'paragraph' &&
                $from.parent.content.size === 0 &&
                editor.isEditable &&
                ai.state.phase === 'closed'
              )
            }}
          >
            <button
              type="button"
              onClick={() => ai.open('insert')}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors whitespace-nowrap"
              title="Write with AI at the cursor"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" /> Press <kbd className="font-mono">/</kbd> or <kbd className="font-mono">⌘J</kbd> to write with AI
            </button>
          </FloatingMenu>
          {ai.selection.hasSelection && ai.state.phase === 'closed' && (
            <div className="md:hidden absolute bottom-12 right-3 z-20">
              <button
                type="button"
                onClick={() => ai.open('rewrite')}
                disabled={ai.selection.multiBlock}
                className="glass-card shadow-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 text-accent disabled:text-muted disabled:opacity-70"
              >
                <Sparkles className="w-4 h-4" /> {ai.selection.multiBlock ? 'Select one paragraph' : 'Improve'}
              </button>
            </div>
          )}
          <InlineAIPrompt editor={editor} ai={ai} />
        </>
      )}

      {/* Bottom Status Bar */}
      <div className="h-10 border-t border-border bg-surface backdrop-blur-md flex items-center justify-between px-4 shrink-0 text-xs text-muted font-mono">
        <div className="flex items-center gap-4">
          <span className="tabular-nums">
            {targetWords ? (
              <>
                <span className={onTarget ? 'text-green-500' : 'text-heading'}>{nf.format(wordCount)}</span>
                {' / '}
                {nf.format(targetWords)} words
              </>
            ) : (
              <>{nf.format(wordCount)} words</>
            )}
          </span>
          <span className="tabular-nums">{nf.format(characterCount)} characters</span>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'unsaved' && <span className="text-warning">Unsaved changes</span>}
          {saveStatus === 'saving' && (
            <span className="text-accent flex items-center gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && <span className="text-success">All changes saved</span>}
          {saveStatus === 'error' && <span className="text-red-400">Changes not saved</span>}
        </div>
      </div>
    </div>
  )
}
