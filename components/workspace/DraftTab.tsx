'use client'

import { useState, type MutableRefObject } from 'react'
import type { Editor } from '@tiptap/react'
import { Clock, Highlighter, Loader2, RotateCcw, Save, Sparkles, Square, X, PenLine } from 'lucide-react'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { countWords } from '@/lib/articles/text'
import { cleanGeneratedHtml } from '@/lib/pipeline/html'
import { StreamingPreview } from './StreamingPreview'
import { hasDraft, hasResearch, type ModelsInUse, type WorkspaceArticle } from './types'

const nf = new Intl.NumberFormat('en-US')

function ToolButton({
  onClick,
  title,
  active,
  disabled,
  children,
}: {
  onClick: () => void
  title: string
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
        active ? 'bg-badge-seo/15 text-blue-500' : 'text-muted hover:text-heading hover:bg-surface-hover'
      }`}
    >
      {children}
    </button>
  )
}

// DR-005 Draft tab: streaming preview during generation, then the Poe editor with autosave,
// actual/target words, keyword highlight, Save version, Versions and Regenerate.
export function DraftTab({
  article,
  models,
  editorKey,
  editorRef,
  streaming,
  streamText,
  activeSuggestionId,
  onClearSuggestion,
  onSave,
  onContentChange,
  onEditorReady,
  onSaveVersion,
  onOpenVersions,
  onRegenerate,
  onGenerate,
  onStop,
}: {
  article: WorkspaceArticle
  models: ModelsInUse
  /** Changes when the draft is replaced server-side (generate, restore): remounts the editor. */
  editorKey: string
  editorRef: MutableRefObject<Editor | null>
  streaming: boolean
  streamText: string
  activeSuggestionId: string | null
  onClearSuggestion: () => void
  onSave: (html: string) => Promise<unknown>
  onContentChange: (html: string) => void
  onEditorReady: (editor: Editor) => void
  onSaveVersion: () => void
  onOpenVersions: () => void
  onRegenerate: () => void
  onGenerate: () => void
  onStop: () => void
}) {
  const [highlightKeywords, setHighlightKeywords] = useState(false)
  const keywords = [article.primaryKeyword, ...article.keywords].filter(
    (k, i, all): k is string => !!k && all.findIndex((x) => x?.toLowerCase() === k.toLowerCase()) === i,
  )

  if (streaming) {
    const words = countWords(cleanGeneratedHtml(streamText))
    return (
      <div className="flex flex-col h-full">
        <div className="border-b border-border bg-surface/95 px-4 py-2 flex items-center gap-3 text-sm">
          <Loader2 className="w-4 h-4 text-accent animate-spin" />
          <span className="text-heading">{streamText ? 'Writing the draft…' : 'Starting generation…'}</span>
          <span className="text-xs text-muted font-mono">{models.generation}</span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onStop}
            className="px-3 py-1.5 rounded-input text-xs border border-border text-muted hover:text-heading hover:bg-surface-hover flex items-center gap-1.5"
          >
            <Square className="w-3 h-3" /> Stop
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--color-editor-bg)]">
          <StreamingPreview html={streamText} />
        </div>
        <div className="h-10 border-t border-border bg-surface flex items-center justify-between px-4 shrink-0 text-xs text-muted font-mono">
          <span className="tabular-nums">
            {nf.format(words)}
            {article.targetWordCount ? ` / ${nf.format(article.targetWordCount)}` : ''} words
          </span>
          <span>Read-only while generating · saved when it finishes</span>
        </div>
      </div>
    )
  }

  if (!hasDraft(article)) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="glass-card p-10 text-center space-y-4">
          <PenLine className="w-8 h-8 text-accent mx-auto" />
          <h2 className="text-xl font-display text-heading">No draft yet</h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            Generate a first draft from the brief, keywords{hasResearch(article) ? ' and research' : ''}. You can edit it freely afterwards.
          </p>
          <button
            type="button"
            onClick={onGenerate}
            className="bg-accent hover:bg-accent/90 text-white px-6 py-2.5 rounded-input text-sm font-medium inline-flex items-center gap-2 transition-all shadow-glow-accent hover:shadow-glow-accent-strong"
          >
            <Sparkles className="w-4 h-4" />
            Generate draft
            {article.targetWordCount ? (
              <span className="font-mono tabular-nums text-white/80">· {nf.format(article.targetWordCount)} words</span>
            ) : null}
          </button>
          <p className="text-xs text-muted font-mono">{models.generation ?? 'No generation model configured'}</p>
          {!hasResearch(article) && (
            <p className="text-xs text-muted">No research yet. The draft will rely on the model’s own knowledge.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative bg-[var(--color-editor-bg)] [&_.ProseMirror_h3]:font-display [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:text-heading [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ol]:list-decimal">
      {activeSuggestionId && (
        <div className="absolute top-14 right-4 z-20">
          <button
            type="button"
            onClick={onClearSuggestion}
            className="bg-surface border border-border hover:bg-surface-hover text-muted px-3 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear selection
          </button>
        </div>
      )}
      <RichTextEditor
        key={editorKey}
        content={article.draftHtml ?? ''}
        placeholder="Start writing…"
        onSave={onSave}
        autoSaveDelay={2000}
        editorRef={editorRef}
        onReady={onEditorReady}
        onContentChange={(html) => onContentChange(html)}
        targetWords={article.targetWordCount}
        keywords={keywords}
        highlightKeywords={highlightKeywords}
        toolbarExtra={
          <div className="flex items-center gap-0.5 mr-1">
            <ToolButton
              onClick={() => setHighlightKeywords((v) => !v)}
              title="Highlight SEO keywords"
              active={highlightKeywords}
              disabled={!keywords.length}
            >
              <Highlighter className="w-3.5 h-3.5" /> Keywords
            </ToolButton>
            <ToolButton onClick={onSaveVersion} title="Save the current draft as a version">
              <Save className="w-3.5 h-3.5" /> Save version
            </ToolButton>
            <ToolButton onClick={onOpenVersions} title="Version history">
              <Clock className="w-3.5 h-3.5" /> Versions
            </ToolButton>
            <ToolButton onClick={onRegenerate} title="Regenerate the draft (the current draft is saved as a version first)">
              <RotateCcw className="w-3.5 h-3.5" /> Regenerate
            </ToolButton>
          </div>
        }
      />
    </div>
  )
}
