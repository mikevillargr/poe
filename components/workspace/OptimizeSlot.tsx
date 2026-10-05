'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, FlaskConical, ListChecks } from 'lucide-react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { useSuggestionStore, type SuggestionState } from '@/stores/useSuggestionStore'
import { useToast } from '@/hooks/useToast'
import { htmlToText } from '@/lib/articles/text'
import type { EditorApi } from './useEditorApi'
import { SuggestionCard } from './SuggestionCard'

/**
 * Optimize panel mount slot (DR-005 right panel). PLACEHOLDER until WS optimize delivers
 * `<OptimizePanel articleId html editorApi />` (keyword coverage, length gauge, guideline check).
 * It already runs the Analyze editor's suggestion loop on the workspace editor, driven by
 * `useSuggestionStore`: click a card to highlight the text, Accept (find/replace into TipTap),
 * Adjust (recompose; disabled until WS optimize ships …/recompose), Dismiss / Undo, filter chips.
 */
export interface OptimizeSlotProps {
  clientId: string
  articleId: string
  /** Latest draft HTML (updates as the editor autosaves). */
  html: string
  editorApi: EditorApi
  activeSuggestionId: string | null
  onActiveSuggestionChange: (id: string | null) => void
}

const CHECK_TOOLTIP = 'Coming in WS optimize'

export function OptimizeSlot({ articleId, html, editorApi, activeSuggestionId, onActiveSuggestionChange }: OptimizeSlotProps) {
  const { toast } = useToast()
  const { suggestions, setSuggestions, acceptSuggestion, dismissSuggestion, undoDismiss, updateSuggestion, finishRecomposition } =
    useSuggestionStore()
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Suggestions belong to one article: clear them when the workspace opens another.
  useEffect(() => {
    setSuggestions([])
    onActiveSuggestionChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  const all = useMemo(() => Array.from(suggestions.values()), [suggestions])
  const categories = useMemo(() => [...new Set(all.map((s) => s.category))], [all])
  const filtered = all.filter((s) => {
    if (activeFilter === 'All') return s.status === 'pending'
    if (activeFilter === 'Accepted') return s.status === 'accepted'
    if (activeFilter === 'Dismissed') return s.status === 'dismissed'
    return s.category === activeFilter && s.status === 'pending'
  })

  function select(s: SuggestionState) {
    onActiveSuggestionChange(s.id)
    const n = editorApi.highlight([{ text: s.original, id: s.id }])
    if (!n && editorApi.isReady()) toast.warning('Text not found in the draft', 'It may have been edited since this suggestion was made.')
  }

  function clearActive() {
    onActiveSuggestionChange(null)
    editorApi.highlight([])
  }

  function accept(s: SuggestionState) {
    if (!editorApi.applySuggestion(s.original, s.suggested)) {
      toast.warning('Couldn’t apply the suggestion', 'The original text isn’t in the draft any more.')
      return
    }
    acceptSuggestion(s.id)
    clearActive()
  }

  function dismiss(s: SuggestionState) {
    dismissSuggestion(s.id)
    if (activeSuggestionId === s.id) clearActive()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Score */}
      <div className="p-6 border-b border-border flex flex-col items-center shrink-0 relative">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-surface to-transparent pointer-events-none opacity-30" />
        <h2 className="text-[10px] font-medium text-muted mb-4 w-full text-left uppercase tracking-wider">Overall Score</h2>
        <ScoreGauge score={0} size={120} />
        <p className="text-xs text-muted mt-4 font-mono">Not checked yet</p>
        <span className="w-full mt-4" title={CHECK_TOOLTIP}>
          <button
            type="button"
            disabled
            aria-label={`Check against guidelines (${CHECK_TOOLTIP})`}
            className="w-full bg-accent text-white px-4 py-2.5 rounded-input text-sm font-medium shadow-glow-accent opacity-50 cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Check against guidelines
          </button>
        </span>
      </div>

      {/* Suggestions */}
      <div className="p-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading font-display text-lg flex items-center gap-2">
            Suggestions
            <span className="bg-surface text-muted px-2 py-0.5 rounded-full text-xs font-mono tabular-nums border border-border">
              {filtered.length}
            </span>
          </h2>
          {activeSuggestionId && (
            <button type="button" onClick={clearActive} className="text-xs text-muted hover:text-heading transition-colors">
              Clear selection
            </button>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...categories, 'Accepted', 'Dismissed'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-input text-xs font-medium transition-all ${
                activeFilter === filter
                  ? 'bg-accent text-white shadow-glow-accent'
                  : 'bg-surface border border-border text-muted hover:text-heading hover:border-accent/50'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
        {filtered.map((s) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            isActive={activeSuggestionId === s.id}
            isExpanded={expandedId === s.id}
            onSelect={() => select(s)}
            onAccept={() => accept(s)}
            onDismiss={() => dismiss(s)}
            onUndoDismiss={() => undoDismiss(s.id)}
            onExpand={(open) => setExpandedId(open ? s.id : null)}
            onRecompose={(text, meta) => {
              updateSuggestion(s.id, text, meta)
              finishRecomposition(s.id)
              setExpandedId(null)
            }}
          />
        ))}

        {all.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <ListChecks className="w-6 h-6 text-muted mx-auto" />
            <p className="text-sm text-muted">
              Guideline and keyword suggestions appear here once the guideline check lands (WS optimize).
            </p>
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                onClick={() => {
                  const demo = demoSuggestions(html)
                  if (!demo.length) toast.info('Generate a draft first', 'Sample suggestions are taken from the draft text.')
                  setSuggestions(demo)
                  setActiveFilter('All')
                }}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-input border border-dashed border-border text-muted hover:text-heading hover:border-accent/50 transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Load sample suggestions (dev only)
              </button>
            )}
          </div>
        )}
        {all.length > 0 && filtered.length === 0 && <p className="text-sm text-muted text-center py-6">Nothing here.</p>}
      </div>
    </div>
  )
}

/** Dev-only: deterministic sample suggestions built from phrases that are really in the draft. */
function demoSuggestions(html: string): SuggestionState[] {
  const sentences = htmlToText(html)
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 6)
  const picks = [sentences[1], sentences[3], sentences[5]].filter(Boolean) as string[]
  const meta: Array<Pick<SuggestionState, 'category' | 'severity' | 'title'>> = [
    { category: 'Blacklist', severity: 'high', title: 'Sample: rephrase a sentence that reads as AI-written' },
    { category: 'SEO', severity: 'medium', title: 'Sample: work the primary keyword into this sentence' },
    { category: 'Brand', severity: 'low', title: 'Sample: tighten to match the brand voice' },
  ]
  return picks.map((original, i) => {
    const words = original.split(/\s+/)
    const fragment = words.slice(0, Math.min(words.length, 8)).join(' ')
    return {
      id: `demo-${i}`,
      status: 'pending',
      ...meta[i],
      original: fragment,
      suggested: `${fragment.replace(/[.,;:!?]+$/, '')} (sample rewrite)`,
    }
  })
}
