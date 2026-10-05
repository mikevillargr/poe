'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Editor } from '@tiptap/react'
import { AlertTriangle, Check, Loader2, Pencil, RotateCcw, Sparkles, Square, X } from 'lucide-react'
import { AI_EDIT_PRESET_TABLE, type AiEditPreset } from '@/lib/prompts/ai-edit-presets'
import { AI_EDIT_LIMITS } from '@/lib/prompts/ai-edit-presets'
import { adjustInstruction, plainPreview, warningMessages } from '@/lib/ai-edit/text'
import { canAccept } from '@/lib/ai-edit/state'
import { getAiRange } from '@/lib/tiptap/ai-edit'
import type { InlineAIEdit } from '@/hooks/useInlineAIEdit'

// DR-009: the one inline prompt for both "Improve selected text" (rewrite) and "Generate at cursor"
// (insert). Phases: prompt → streaming → preview (+ error / stale). Anchored under the selection on
// desktop, a bottom sheet below 768px. Nothing touches the document until Accept / Insert.

const GROUPS: Array<{ label: string; ids: AiEditPreset[] }> = [
  { label: 'Length', ids: ['shorten', 'expand'] },
  { label: 'Tone', ids: ['simplify', 'casual', 'formal'] },
  { label: 'Fix', ids: ['fix_grammar'] },
]

const PANEL_W = 340

function useIsMobile() {
  const [m, setM] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

interface Anchor {
  top: number
  bottom: number
  left: number
}

function useAnchor(editor: Editor | null, active: boolean): Anchor | null {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const update = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const r = getAiRange(editor)
    if (!r) return setAnchor(null)
    try {
      const max = editor.state.doc.content.size
      const a = editor.view.coordsAtPos(Math.min(Math.max(r.from, 1), max))
      const b = editor.view.coordsAtPos(Math.min(Math.max(r.to, 1), max))
      setAnchor({ top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.min(a.left, b.left) })
    } catch {
      setAnchor(null)
    }
  }, [editor])
  useLayoutEffect(() => {
    if (!active || !editor) return
    update()
    editor.on('transaction', update)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      editor.off('transaction', update)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [active, editor, update])
  return anchor
}

export function InlineAIPrompt({ editor, ai }: { editor: Editor | null; ai: InlineAIEdit }) {
  const { state, streamText } = ai
  const open = state.phase !== 'closed'
  const isMobile = useIsMobile()
  const reduce = useReducedMotion()
  const anchor = useAnchor(editor, open)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const adjusting = state.phase === 'prompt' && !!state.html
  const insert = state.mode === 'insert'
  const resultText = plainPreview(state.html)

  // Reset the local fields whenever a fresh prompt opens; keep focus where the keyboard needs it.
  useEffect(() => {
    if (state.phase === 'closed') {
      setText('')
      setEditing(false)
    }
    if (state.phase === 'prompt') {
      setText('')
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    if (state.phase === 'preview') {
      setEditing(false)
      setDraft(plainPreview(state.html))
      panelRef.current?.focus()
    }
  }, [state.phase, state.html])

  const runPreset = (preset: AiEditPreset) => ai.run(preset, '')
  const submit = () => {
    const extra = text.trim()
    if (adjusting) {
      ai.run(insert ? null : 'custom', adjustInstruction(state.preset, state.instruction, extra))
      return
    }
    if (!insert && !extra) return
    ai.run(insert ? null : 'custom', extra)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      ai.close()
      return
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && state.phase === 'preview') {
      e.preventDefault()
      ai.accept(editing ? draft : undefined)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-ai-nav]') ?? [])
      if (!items.length) return
      const i = items.indexOf(document.activeElement as HTMLElement)
      const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
      e.preventDefault()
      items[next].focus()
    }
  }

  if (!mounted || !open) return null

  const label = insert ? 'Write with AI' : state.preset && state.preset !== 'custom' ? AI_EDIT_PRESET_TABLE[state.preset].label : 'Improve'
  const warnings = warningMessages(state.warnings)
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const placeAbove = anchor ? anchor.bottom + 360 > vh && anchor.top > 380 : false
  const style: React.CSSProperties = isMobile
    ? { left: 0, right: 0, bottom: 0 }
    : anchor
      ? {
          width: PANEL_W,
          left: Math.max(8, Math.min(anchor.left, vw - PANEL_W - 8)),
          ...(placeAbove ? { bottom: vh - anchor.top + 8 } : { top: Math.min(anchor.bottom + 8, vh - 200) }),
        }
      : { width: PANEL_W, left: 16, top: 120 }

  const stripe = insert ? 'bg-success' : 'bg-accent'

  const panel = (
    <motion.div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={insert ? 'Write with AI' : 'AI rewrite'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      initial={reduce ? { opacity: 0 } : isMobile ? { y: 80, opacity: 0 } : { y: -6, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 360, damping: 32 } }}
      className={`fixed z-[60] glass-card shadow-2xl outline-none overflow-hidden ${isMobile ? 'rounded-b-none rounded-t-xl max-h-[85vh] overflow-y-auto' : 'max-h-[min(70vh,560px)] overflow-y-auto'}`}
      style={{ ...style, background: 'var(--color-card-bg)' }}
      data-testid="inline-ai-prompt"
    >
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${stripe}`} />
      <div className="p-3 pl-4 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium text-heading">{state.phase === 'prompt' ? (adjusting ? 'Adjust' : insert ? 'Write with AI' : 'Improve') : label}</span>
          <div className="flex-1" />
          {(state.phase === 'preview' || state.phase === 'error') && (
            <button
              type="button"
              onClick={() => ai.run(state.preset, state.instruction)}
              className="text-muted hover:text-heading flex items-center gap-1"
              title="Run it again"
            >
              <RotateCcw className="w-3 h-3" /> Try again
            </button>
          )}
          <button type="button" onClick={ai.close} aria-label="Discard (Esc)" className="p-0.5 text-muted hover:text-heading">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {state.phase === 'prompt' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-input border border-border bg-surface focus-within:ring-1 focus-within:ring-accent px-2.5">
              <input
                ref={inputRef}
                data-ai-nav
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault()
                    submit()
                  }
                }}
                maxLength={AI_EDIT_LIMITS.instruction}
                aria-label={adjusting ? 'What should change?' : insert ? 'What should AI write?' : 'Tell AI what to do'}
                placeholder={
                  adjusting ? 'e.g. Keep the second clause' : insert ? 'e.g. Add a 2-sentence example about a local bakery' : 'Tell AI what to do…'
                }
                className="flex-1 bg-transparent py-2 text-sm text-heading placeholder:text-muted outline-none min-w-0"
              />
              <button
                type="button"
                data-ai-nav
                onClick={submit}
                disabled={!insert && !adjusting && !text.trim()}
                aria-label="Run"
                className="text-xs text-accent font-medium disabled:opacity-40 px-1"
              >
                ⏎
              </button>
            </div>
            {insert && !adjusting && (
              <p className="text-xs text-muted">Leave it empty to continue writing here. Uses the text before and after this spot.</p>
            )}
            {adjusting && (
              <div className="text-xs text-muted">
                Re-runs on the original text with your extra instruction.
              </div>
            )}
            {!insert && !adjusting && (
              <div role="menu" aria-label="Quick edits" className="space-y-2">
                {GROUPS.map((g) => (
                  <div key={g.label}>
                    <p className="text-[10px] uppercase tracking-wider text-muted mb-1">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.ids.map((id) => (
                        <button
                          key={id}
                          type="button"
                          role="menuitem"
                          data-ai-nav
                          onClick={() => runPreset(id)}
                          className="px-2.5 py-1 rounded-full text-xs border border-border text-body hover:text-heading hover:bg-surface-hover hover:border-accent/50 transition-colors"
                        >
                          {AI_EDIT_PRESET_TABLE[id].label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.phase === 'streaming' && (
          <div className="space-y-2">
            <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              {streamText ? (insert ? 'Writing…' : 'Rewriting…') : 'Waiting for the first words…'}
            </div>
            <Diff original={insert ? '' : state.original} suggested={plainPreview(streamText)} streaming />
            <button
              type="button"
              onClick={ai.stop}
              className="px-3 py-1.5 rounded text-xs border border-border text-muted hover:text-heading hover:bg-surface-hover flex items-center gap-1.5"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          </div>
        )}

        {state.phase === 'preview' && (
          <div className="space-y-2.5">
            <p role="status" aria-live="polite" className="sr-only">
              Suggestion ready. Press Command Enter to {insert ? 'insert' : 'accept'}, Escape to discard.
            </p>
            {editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                aria-label="Edit the suggested text"
                className="w-full rounded border border-success/30 bg-success/10 p-2 text-xs text-green-400 outline-none focus:ring-1 focus:ring-success"
              />
            ) : (
              <Diff original={insert ? '' : state.original} suggested={resultText} />
            )}
            {warnings.map((w) => (
              <p key={w} role="status" className="flex items-start gap-1.5 text-xs text-orange-400">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {w}
              </p>
            ))}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => ai.accept(editing ? draft : undefined)}
                disabled={!canAccept(state) || (editing && !draft.trim())}
                className="flex-1 bg-success hover:bg-success/90 disabled:opacity-50 text-white py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> {insert ? 'Insert' : 'Accept'}
                <kbd className="hidden md:inline font-mono text-[10px] opacity-70 ml-0.5">⌘↵</kbd>
              </button>
              <button
                type="button"
                onClick={ai.adjust}
                className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" /> Adjust
              </button>
              <button
                type="button"
                onClick={ai.close}
                className="flex-1 bg-surface border border-border hover:bg-surface-hover text-muted py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Discard
              </button>
            </div>
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="text-xs text-muted hover:text-heading flex items-center gap-1"
              aria-pressed={editing}
            >
              <Pencil className="w-3 h-3" /> {editing ? 'Back to the suggestion' : 'Edit the text'}
            </button>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="space-y-2">
            <p role="alert" className="text-xs text-red-400">
              Couldn’t {insert ? 'write this' : 'rewrite'}: {state.error}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => ai.run(state.preset, state.instruction)} className="px-3 py-1.5 rounded text-xs bg-accent/20 text-accent hover:bg-accent/30">
                Try again
              </button>
              <button type="button" onClick={ai.close} className="px-3 py-1.5 rounded text-xs border border-border text-muted hover:bg-surface-hover">
                Discard
              </button>
            </div>
          </div>
        )}

        {state.phase === 'stale' && (
          <div className="space-y-2">
            <p role="alert" className="flex items-start gap-1.5 text-xs text-orange-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              {insert ? 'The spot changed, so this can’t be inserted.' : 'The text changed, so this can’t be applied. Select it again to rewrite.'}
            </p>
            <button type="button" onClick={ai.close} className="px-3 py-1.5 rounded text-xs border border-border text-muted hover:bg-surface-hover">
              Discard
            </button>
          </div>
        )}

        {state.phase === 'prompt' && (
          <p className="hidden md:block text-[10px] text-muted font-mono">Esc to discard · nothing changes until you accept</p>
        )}
      </div>
    </motion.div>
  )

  return createPortal(panel, document.body)
}

function Diff({ original, suggested, streaming }: { original: string; suggested: string; streaming?: boolean }) {
  return (
    <div className="space-y-1.5">
      {original && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">Original</p>
          <div className="bg-danger/10 border border-danger/20 rounded p-2 text-xs text-red-400 line-through max-h-24 overflow-y-auto custom-scrollbar">{original}</div>
        </div>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">{original ? 'Suggested' : 'New text'}</p>
        <div
          aria-busy={streaming}
          className="bg-success/10 border border-success/20 rounded p-2 text-xs text-green-400 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar min-h-[2rem]"
          data-testid="ai-suggested"
        >
          {suggested}
          {streaming && <span className="inline-block w-1.5 h-3 bg-green-400 ml-0.5 align-middle animate-pulse" />}
        </div>
      </div>
    </div>
  )
}
