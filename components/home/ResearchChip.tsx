'use client'

import { Check, Loader2, Search } from 'lucide-react'
import type { ArticleSummary } from '@/lib/articles/schemas'

// DR-017: research before writing, per topic, shown and changed in place (Linear-style chip). Only queued topics
// can change it; once researched or drafted it just reports what happened.

const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] border shrink-0 transition-colors'

export function ResearchChip({
  article,
  researching,
  researched,
  disabled,
  onToggle,
}: {
  article: ArticleSummary
  /** True while a batch is researching this row. */
  researching?: boolean
  /** True once a batch has researched this row (the article list refreshes when the batch ends). */
  researched?: boolean
  disabled?: boolean
  onToggle: (on: boolean) => void
}) {
  if (article.status !== 'queued') return null
  if (researching || article.researchStatus === 'running') {
    return (
      <span className={`${base} border-accent/40 text-accent bg-accent/10`}>
        <Loader2 className="w-3 h-3 animate-spin" /> Researching…
      </span>
    )
  }
  if (researched || article.researchStatus === 'ready') {
    return (
      <span className={`${base} border-success/40 text-green-500 bg-success/10`} title="Research is done; the draft will use it.">
        <Check className="w-3 h-3" /> Researched
      </span>
    )
  }
  const on = article.researchEnabled !== false
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        onToggle(!on)
      }}
      onKeyDown={(e) => e.stopPropagation()}
      title={on ? 'Research before writing: on. Click to turn it off for this topic.' : 'Research before writing: off. Click to turn it on for this topic.'}
      className={`${base} disabled:opacity-50 ${
        on ? 'border-accent/40 text-accent hover:bg-accent/10' : 'border-dashed border-border text-muted hover:text-heading hover:border-muted'
      }`}
    >
      <Search className="w-3 h-3" />
      {on ? 'Research' : 'No research'}
    </button>
  )
}
