'use client'

import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import UnderlineExtension from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import {
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Trash2,
  Link2,
} from 'lucide-react'

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
  onSave?: (content: string) => void
  autoSaveDelay?: number
  activeSuggestionId?: string | null
  onSuggestionClick?: (id: string) => void
  onContentChange?: (content: string, wordCount: number, charCount: number) => void
  editorRef?: React.MutableRefObject<any>
  onDelete?: () => void
}

// Plugin key for our decoration plugin
const highlightPluginKey = new PluginKey('suggestionHighlight')

// TipTap extension that uses ProseMirror decorations (not marks) for highlighting
const SuggestionHighlightExtension = Extension.create({
  name: 'suggestionHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: highlightPluginKey,
        state: {
          init() {
            return DecorationSet.empty
          },
          apply(tr, oldSet) {
            // Check if we have new decorations via metadata
            const meta = tr.getMeta(highlightPluginKey)
            if (meta !== undefined) {
              return meta
            }
            // Map existing decorations through document changes
            return oldSet.map(tr.mapping, tr.doc)
          },
        },
        props: {
          decorations(state) {
            return highlightPluginKey.getState(state)
          },
        },
      }),
    ]
  },
})

// Find all positions of a search string within the ProseMirror document
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findTextPositions(doc: any, searchText: string): Array<{ from: number; to: number }> {
  const results: Array<{ from: number; to: number }> = []
  const search = searchText.toLowerCase()

  doc.descendants((node: any, pos: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!node.isText) return
    const text: string = node.text || ''
    const lower = text.toLowerCase()
    let idx = lower.indexOf(search)
    while (idx !== -1) {
      results.push({ from: pos + idx, to: pos + idx + search.length })
      idx = lower.indexOf(search, idx + 1)
    }
  })

  return results
}

export function RichTextEditor({
  content = '',
  suggestions,
  placeholder = 'Start writing or paste your content here...',
  onSave,
  autoSaveDelay = 2000,
  activeSuggestionId,
  onSuggestionClick,
  onContentChange,
  editorRef,
  onDelete,
}: RichTextEditorProps) {
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [wordCount, setWordCount] = useState(0)
  const prevSuggestionRef = useRef<string | null | undefined>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      CharacterCount.configure({
        limit: null,
      }),
      UnderlineExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-accent underline cursor-pointer',
        },
      }),
      SuggestionHighlightExtension,
    ],
    content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] px-6',
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved')

      // Update word count
      const text = editor.getText()
      const words = text.trim().split(/\s+/).filter(word => word.length > 0)
      setWordCount(words.length)
      
      // Notify parent of content changes
      if (onContentChange) {
        const charCount = editor.storage.characterCount.characters()
        onContentChange(editor.getHTML(), words.length, charCount)
      }
    },
  })

  // Expose editor instance to parent via ref
  useEffect(() => {
    if (editorRef && editor) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

  // Apply/remove decorations  // Highlight active suggestion
  useEffect(() => {
    if (!editor || !editor.view || !editor.isEditable) return
    if (prevSuggestionRef.current === activeSuggestionId) return
    
    // Small delay to ensure editor is fully ready after content changes
    const timer = setTimeout(() => {
      if (!editor || !editor.view) return
      
      prevSuggestionRef.current = activeSuggestionId

      const { state } = editor.view
      const { doc, tr } = state

      if (!activeSuggestionId || !suggestions) {
        // Clear all decorations
        tr.setMeta(highlightPluginKey, DecorationSet.empty)
        editor.view.dispatch(tr)
        return
      }

      const suggestion = suggestions.find(s => s.id === activeSuggestionId)
      if (!suggestion || !suggestion.original) {
        tr.setMeta(highlightPluginKey, DecorationSet.empty)
        editor.view.dispatch(tr)
        return
      }

      // Find positions of the original text in the document
      const positions = findTextPositions(doc, suggestion.original)

      if (positions.length === 0) {
        console.warn('No matches found for:', suggestion.original)
        tr.setMeta(highlightPluginKey, DecorationSet.empty)
        editor.view.dispatch(tr)
        return
      }

      // Create inline decorations at each position
      const decorations = positions.map(({ from, to }) =>
        Decoration.inline(from, to, {
          class: 'suggestion-highlight',
          'data-suggestion-id': suggestion.id,
        })
      )

      const decoSet = DecorationSet.create(doc, decorations)
      tr.setMeta(highlightPluginKey, decoSet)
      editor.view.dispatch(tr)

      // Scroll to first match
      setTimeout(() => {
        const el = editor.view.dom.querySelector('.suggestion-highlight')
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 50)
    }, 10)
    
    return () => clearTimeout(timer)
  }, [activeSuggestionId, editor, suggestions])

  // Auto-save with debouncing
  useEffect(() => {
    if (!editor || saveStatus !== 'unsaved') return

    const timer = setTimeout(() => {
      if (onSave && editor) {
        setSaveStatus('saving')
        const html = editor.getHTML()
        onSave(html)

        setTimeout(() => {
          setSaveStatus('saved')
        }, 500)
      }
    }, autoSaveDelay)

    return () => clearTimeout(timer)
  }, [editor, saveStatus, onSave, autoSaveDelay])

  const handleSave = useCallback(() => {
    if (!editor || !onSave) return

    setSaveStatus('saving')
    const html = editor.getHTML()
    onSave(html)

    setTimeout(() => {
      setSaveStatus('saved')
    }, 500)
  }, [editor, onSave])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted">Loading editor...</div>
      </div>
    )
  }

  const characterCount = editor.storage.characterCount.characters()

  return (
    <div className="flex flex-col h-full">
      {/* Formatting Toolbar */}
      <div className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur-sm px-4 py-2 flex items-center gap-1 flex-wrap">
        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bold')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Bold (Cmd+B)"
        >
          <Bold className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('italic')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Italic (Cmd+I)"
        >
          <Italic className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('underline')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Underline (Cmd+U)"
        >
          <Underline className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Link */}
        <button
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={`p-2 rounded transition-colors ${
            editor.isActive('link')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Add Link"
        >
          <Link2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('bulletList')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('orderedList')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded transition-colors ${
            editor.isActive('blockquote')
              ? 'bg-accent text-white'
              : 'text-muted hover:text-heading hover:bg-surface-hover'
          }`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded transition-colors text-muted hover:text-heading hover:bg-surface-hover disabled:opacity-50"
          title="Undo (Cmd+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded transition-colors text-muted hover:text-heading hover:bg-surface-hover disabled:opacity-50"
          title="Redo (Cmd+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </button>

        {onDelete && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <button
              onClick={onDelete}
              className="p-2 rounded transition-colors text-muted hover:text-danger hover:bg-danger/10"
              title="Delete document"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}

        <div className="flex-1" />

        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving'}
          className="px-4 py-2 rounded transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
        >
          {saveStatus === 'saved' && (
            <span className="text-success">Saved</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-accent">Saving...</span>
          )}
          {saveStatus === 'unsaved' && (
            <span className="text-warning">Unsaved changes</span>
          )}
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <EditorContent editor={editor} />
      </div>

      {/* Bottom Status Bar */}
      <div className="h-10 border-t border-border bg-surface backdrop-blur-md flex items-center justify-between px-4 shrink-0 text-xs text-muted font-mono">
        <div className="flex items-center gap-4">
          <span className="tabular-nums">{wordCount} words</span>
          <span className="tabular-nums">{characterCount} characters</span>
        </div>

        <div className="flex items-center gap-2">
          {saveStatus === 'unsaved' && (
            <span className="text-warning">Unsaved changes</span>
          )}
          {saveStatus === 'saving' && (
            <span className="text-accent flex items-center gap-1">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-success">All changes saved</span>
          )}
        </div>
      </div>
    </div>
  )
}

