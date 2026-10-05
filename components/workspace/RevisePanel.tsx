'use client'

import { useEffect, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'

// DR-009 decision 1: the "Revise with feedback" panel, docked above the editor so the draft stays
// visible while you write feedback. Feedback is per-revision, never merged into the brief.

export const REVISE_MAX = 4000

const CHIPS: Array<{ label: string; text: string }> = [
  { label: 'Shorter', text: 'Make it shorter: trim about 15% without losing the key points.' },
  { label: 'Less salesy', text: 'Make the tone less salesy and more helpful.' },
  { label: 'More examples', text: 'Add more concrete examples.' },
  { label: 'Stronger intro', text: 'Write a stronger, more engaging introduction.' },
]

const nf = new Intl.NumberFormat('en-US')

export function RevisePanel({
  id,
  feedback,
  onFeedback,
  model,
  onRun,
  onClose,
}: {
  id: string
  feedback: string
  onFeedback: (v: string) => void
  model: string | null
  onRun: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const reduce = useReducedMotion()
  useEffect(() => {
    ref.current?.focus()
  }, [])
  const empty = feedback.trim().length === 0

  return (
    <motion.section
      id={id}
      role="region"
      aria-label="Revise draft"
      initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="border-b border-border bg-surface/80 overflow-hidden shrink-0"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onClose()
        } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !empty) {
          e.preventDefault()
          onRun()
        }
      }}
    >
      <div className="px-4 py-3 space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-medium text-heading">Revise this draft</span>
          <div className="flex-1" />
          {model && <span className="text-xs text-muted font-mono truncate max-w-[40%]">{model}</span>}
          <button type="button" onClick={onClose} aria-label="Close the revise panel" className="p-1 text-muted hover:text-heading md:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="sr-only" htmlFor={`${id}-feedback`}>
          What should change?
        </label>
        <textarea
          id={`${id}-feedback`}
          ref={ref}
          value={feedback}
          onChange={(e) => onFeedback(e.target.value.slice(0, REVISE_MAX))}
          maxLength={REVISE_MAX}
          rows={3}
          placeholder="e.g. Client says the intro is too salesy; add a short section on pricing and cut about 150 words from the conclusion."
          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-heading placeholder:text-muted outline-none focus:ring-1 focus:ring-accent resize-y max-h-48"
        />
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto custom-scrollbar" role="group" aria-label="Quick starts">
            <span className="text-xs text-muted shrink-0">Quick starts:</span>
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                aria-label={`Insert: ${c.label}`}
                onClick={() => {
                  onFeedback((feedback.trim() ? `${feedback.trim()} ${c.text}` : c.text).slice(0, REVISE_MAX))
                  ref.current?.focus()
                }}
                className="shrink-0 px-2.5 py-1 rounded-full text-xs border border-border text-body hover:text-heading hover:bg-surface-hover hover:border-accent/50 transition-colors"
              >
                {c.label}
              </button>
            ))}
          </div>
          <span className={`text-xs font-mono tabular-nums shrink-0 ${feedback.length >= REVISE_MAX ? 'text-red-400' : 'text-muted'}`} aria-live="polite">
            {nf.format(feedback.length)} / {nf.format(REVISE_MAX)}
          </span>
        </div>
        <p className="text-xs text-muted">Keeps: brief · keywords · research · guidelines. Your current draft is saved as “Before revision” first.</p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-input text-xs border border-border text-muted hover:text-heading hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onRun}
            disabled={empty}
            title={empty ? 'Describe what to change' : undefined}
            className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white px-4 py-1.5 rounded-input text-xs font-medium flex items-center gap-1.5 transition-all max-md:flex-1 max-md:justify-center"
          >
            <Sparkles className="w-3.5 h-3.5" /> Revise draft
            <kbd className="hidden md:inline font-mono text-[10px] text-white/70">⌘↵</kbd>
          </button>
        </div>
      </div>
    </motion.section>
  )
}

