'use client'

import { motion } from 'framer-motion'
import { Check, X, Sparkles } from 'lucide-react'
import { CategoryBadge } from '@/components/CategoryBadge'
import { SuggestionRecomposition } from '@/components/SuggestionRecomposition'
import type { SuggestionState } from '@/stores/useSuggestionStore'

// The suggestion card from the Analyze editor, unchanged in look and behaviour (Mike, DR-005):
// category stripe + badge, impact, strike-through original → suggested, Accept / Adjust / Dismiss,
// Undo Dismiss, and the "Active" state when it's highlighted in the editor.

const STRIPE: Record<string, string> = {
  Brand: 'bg-badge-brand',
  SEO: 'bg-badge-seo',
  Blacklist: 'bg-badge-blacklist',
  Agency: 'bg-badge-agency',
}

export function SuggestionCard({
  suggestion,
  isActive,
  isExpanded,
  recomposeUrl,
  onSelect,
  onAccept,
  onDismiss,
  onUndoDismiss,
  onExpand,
  onRecompose,
}: {
  suggestion: SuggestionState
  isActive: boolean
  isExpanded: boolean
  recomposeUrl?: string
  onSelect: () => void
  onAccept: () => void
  onDismiss: () => void
  onUndoDismiss: () => void
  onExpand: (open: boolean) => void
  onRecompose: (newText: string, metadata: { prompt?: string; tonality?: string }) => void
}) {
  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`glass-card p-4 relative overflow-visible cursor-pointer transition-all ${
        isActive ? 'ring-2 ring-accent ring-offset-2 ring-offset-background bg-accent/10 shadow-lg' : 'hover:ring-1 hover:ring-accent/50'
      }`}
      style={{ background: 'var(--color-card-bg)' }}
    >
      {suggestion.status === 'accepted' && (
        <div className="absolute -top-2 -right-2 bg-success text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">
          ✓ Accepted
        </div>
      )}
      {suggestion.status === 'dismissed' && (
        <div className="absolute -top-2 -right-2 bg-muted text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-lg">Dismissed</div>
      )}
      {isActive && suggestion.status === 'pending' && (
        <div className="absolute -top-2 -right-2 bg-accent text-white px-2 py-0.5 rounded-full text-xs font-bold shadow-glow-accent animate-bounce">
          Active
        </div>
      )}

      <div
        className={`absolute left-0 top-0 bottom-0 w-[3px] ${STRIPE[suggestion.category] ?? 'bg-badge-client'} ${
          isActive ? 'shadow-glow-accent animate-pulse' : ''
        }`}
      />

      <div className="flex items-center justify-between mb-3">
        <CategoryBadge category={suggestion.category} variant="solid" />
        <span
          className={`text-xs font-mono ${
            suggestion.severity === 'high' ? 'text-red-400' : suggestion.severity === 'medium' ? 'text-orange-400' : 'text-green-400'
          }`}
        >
          {suggestion.severity === 'high' ? 'High Impact' : suggestion.severity === 'medium' ? 'Medium Impact' : 'Low Impact'}
        </span>
      </div>

      <p className="text-sm text-heading font-medium mb-3">{suggestion.title}</p>

      <div className="space-y-2 mb-4">
        <div className="bg-danger/10 border border-danger/20 rounded p-2 text-xs text-red-400 line-through">{suggestion.original}</div>
        <div className="bg-success/10 border border-success/20 rounded p-2 text-xs text-green-400">{suggestion.suggested}</div>
      </div>

      {isExpanded && suggestion.status === 'pending' && (
        <div onClick={(e) => e.stopPropagation()}>
          <SuggestionRecomposition
            suggestionId={suggestion.id}
            originalText={suggestion.original}
            currentSuggestion={suggestion.suggested}
            recomposeUrl={recomposeUrl}
            onRecompose={onRecompose}
            onCancel={() => onExpand(false)}
          />
        </div>
      )}

      {suggestion.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onAccept()
            }}
            className="flex-1 bg-success hover:bg-success/90 text-white py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onExpand(!isExpanded)
            }}
            title={recomposeUrl ? undefined : 'Adjust is coming with WS optimize'}
            className="flex-1 bg-accent/20 hover:bg-accent/30 text-accent py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" /> Adjust
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
            }}
            className="flex-1 bg-surface border border-border hover:bg-surface-hover text-muted py-1.5 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Dismiss
          </button>
        </div>
      )}

      {suggestion.status === 'dismissed' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onUndoDismiss()
          }}
          className="w-full bg-surface border border-border hover:bg-surface-hover text-heading py-1.5 rounded text-xs font-medium transition-colors mt-3"
        >
          Undo Dismiss
        </button>
      )}
    </motion.div>
  )
}
