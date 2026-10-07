'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Search, SearchX, Sparkles, X, Download } from 'lucide-react'

// DR-017: actions for the selected queue rows, in a floating bar (ClickUp/YNAB pattern).

export function BulkBar({
  count,
  generatable,
  busy,
  onResearch,
  onGenerate,
  onExport,
  onClear,
}: {
  count: number
  /** How many of the selected rows can be generated (queued, not running). */
  generatable: number
  busy?: boolean
  onResearch: (on: boolean) => void
  onGenerate: () => void
  /** DR-021: export the selected articles (links and/or Google Docs). */
  onExport: () => void
  onClear: () => void
}) {
  const btn = 'px-3 py-1.5 rounded-input text-sm font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50'
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="region"
          aria-label="Selected topics"
          aria-live="polite"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 glass-card shadow-xl px-3 py-2 flex items-center gap-2"
        >
          <span className="text-sm text-heading px-2">
            <span className="font-mono tabular-nums">{count}</span> selected
          </span>
          <span className="w-px h-5 bg-border" />
          <button type="button" disabled={busy} onClick={() => onResearch(true)} className={`${btn} text-body hover:bg-surface-hover`}>
            <Search className="w-4 h-4" /> Research on
          </button>
          <button type="button" disabled={busy} onClick={() => onResearch(false)} className={`${btn} text-body hover:bg-surface-hover`}>
            <SearchX className="w-4 h-4" /> Research off
          </button>
          <button
            type="button"
            disabled={busy || generatable === 0}
            onClick={onGenerate}
            title={generatable < count ? `${count - generatable} of the selected can’t be generated (already drafted or running)` : undefined}
            className={`${btn} text-accent hover:bg-accent/10`}
          >
            <Sparkles className="w-4 h-4" /> Generate {generatable}
          </button>
          <button type="button" onClick={onExport} className={`${btn} text-body hover:bg-surface-hover`}>
            <Download className="w-4 h-4" /> Export
          </button>
          <button type="button" onClick={onClear} aria-label="Clear selection" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
