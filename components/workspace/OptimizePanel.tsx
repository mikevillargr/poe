'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, ListChecks, Loader2, Check, AlertTriangle, X, Target } from 'lucide-react'
import { ScoreGauge } from '@/components/ScoreGauge'
import { useSuggestionStore, type SuggestionState } from '@/stores/useSuggestionStore'
import { useToast } from '@/hooks/useToast'
import { apiFetch } from '@/lib/api/fetch'
import { analyzeCoverage, type KeywordCoverage } from '@/lib/optimize/coverage'
import type { DimensionScore, OptimizeSuggestion } from '@/lib/optimize/parse'
import type { EditorApi } from './useEditorApi'
import { SuggestionCard } from './SuggestionCard'

/**
 * Optimize panel (DR-005 right panel, WS optimize): keyword coverage + length gauge (deterministic, live
 * from the editor HTML), then "Check against guidelines" (AI) feeding the existing suggestion loop:
 * click a card to highlight, Accept (find/replace through the editor API), Adjust (recompose), Dismiss/Undo.
 * Accept doesn't write a DB version: autosave stores the edit and Cmd+Z undoes it; the draft's version
 * history stays at meaningful points (generate, regenerate, restore, manual save).
 */
export interface OptimizePanelProps {
  clientId: string
  articleId: string
  /** Latest draft HTML (updates as the editor autosaves). */
  html: string
  keywords: string[]
  primaryKeyword: string | null
  targetWordCount: number | null
  editorApi: EditorApi
  activeSuggestionId: string | null
  onActiveSuggestionChange: (id: string | null) => void
}

interface CheckResult {
  overallScore: number
  dimensionScores: DimensionScore[]
  suggestions: OptimizeSuggestion[]
  dropped: number
  guidelineCount: number
}

const nf = new Intl.NumberFormat('en-US')

function Mark({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${ok ? 'yes' : 'no'}`}
      className={`inline-flex items-center gap-0.5 text-[10px] font-mono ${ok ? 'text-green-500' : 'text-muted'}`}
    >
      {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3 opacity-60" />}
      {label}
    </span>
  )
}

export function OptimizePanel({
  clientId,
  articleId,
  html,
  keywords,
  primaryKeyword,
  targetWordCount,
  editorApi,
  activeSuggestionId,
  onActiveSuggestionChange,
}: OptimizePanelProps) {
  const { toast } = useToast()
  const { suggestions, setSuggestions, acceptSuggestion, dismissSuggestion, undoDismiss, updateSuggestion, finishRecomposition } =
    useSuggestionStore()
  const [activeFilter, setActiveFilter] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)
  const base = `/api/clients/${clientId}/articles/${articleId}`

  // Everything here belongs to one article: reset when the workspace opens another.
  useEffect(() => {
    setSuggestions([])
    setResult(null)
    setActiveFilter('All')
    onActiveSuggestionChange(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId])

  const coverage = useMemo(() => analyzeCoverage(html, keywords, primaryKeyword, targetWordCount), [html, keywords, primaryKeyword, targetWordCount])
  const { length } = coverage

  const all = useMemo(() => Array.from(suggestions.values()), [suggestions])
  const categories = useMemo(() => [...new Set(all.map((s) => s.category))], [all])
  const filtered = all.filter((s) => {
    if (activeFilter === 'All') return s.status === 'pending'
    if (activeFilter === 'Accepted') return s.status === 'accepted'
    if (activeFilter === 'Dismissed') return s.status === 'dismissed'
    return s.category === activeFilter && s.status === 'pending'
  })

  async function check() {
    if (!editorApi.getHTML() && !html) {
      toast.info('Generate a draft first')
      return
    }
    setChecking(true)
    try {
      const r = await apiFetch<CheckResult>(`${base}/optimize`, { method: 'POST', errorTitle: 'Guideline check failed' })
      setResult(r)
      setSuggestions(r.suggestions)
      setActiveFilter('All')
      onActiveSuggestionChange(null)
      editorApi.highlight([])
      if (r.suggestions.length === 0) toast.success('No guideline issues found', `Checked against ${r.guidelineCount} guidelines.`)
      else toast.info(`${r.suggestions.length} suggestions`, `Checked against ${r.guidelineCount} guidelines.`)
    } catch {
      // apiFetch already toasted
    } finally {
      setChecking(false)
    }
  }

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
  function showKeyword(k: KeywordCoverage) {
    if (!k.count) return
    editorApi.highlight([{ text: k.keyword }])
  }

  const lengthColor = length.status === 'on-target' ? 'bg-green-500' : length.status === 'no-target' ? 'bg-[#64748B]' : 'bg-accent'
  const lengthNote =
    length.status === 'no-target'
      ? 'No target length set.'
      : length.status === 'on-target'
        ? 'On target (±10%).'
        : length.status === 'short'
          ? `${nf.format(length.target! - length.words)} words short of the target.`
          : `${nf.format(length.words - length.target!)} words over the target.`

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto custom-scrollbar">
      {/* Keywords */}
      <section className="p-5 border-b border-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] font-medium text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Keywords
          </h2>
          <span className="text-xs font-mono tabular-nums text-muted">{coverage.score}%</span>
        </div>
        {coverage.keywords.length === 0 ? (
          <p className="text-xs text-muted">Add SEO keywords in the brief to track coverage.</p>
        ) : (
          <ul className="space-y-3">
            {coverage.keywords.map((k) => (
              <li key={k.keyword}>
                <button
                  type="button"
                  onClick={() => showKeyword(k)}
                  title={k.count ? 'Highlight in the draft' : 'Not in the draft yet'}
                  className="w-full text-left group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-sm truncate ${k.isPrimary ? 'text-heading font-medium' : 'text-body'} group-hover:text-accent transition-colors`}>
                      {k.isPrimary && <span className="text-accent">★ </span>}
                      {k.keyword}
                    </span>
                    <span
                      className={`text-xs font-mono tabular-nums shrink-0 ${
                        k.status === 'missing' ? 'text-red-400' : k.status === 'overused' ? 'text-orange-500' : 'text-muted'
                      }`}
                    >
                      {k.count}×{k.status === 'overused' && ` · ${k.density}%`}
                    </span>
                  </div>
                  {k.isPrimary ? (
                    <div className="flex items-center gap-3 mt-1">
                      <Mark ok={k.inH1} label="H1" />
                      <Mark ok={k.inIntro} label="100w" />
                      <Mark ok={k.inHeading} label="H2" />
                    </div>
                  ) : (
                    k.status === 'missing' && <div className="text-[11px] text-red-400 mt-0.5">Not used yet</div>
                  )}
                  {k.status === 'overused' && (
                    <div className="text-[11px] text-orange-500 mt-0.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Over 2% of the words
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Length */}
      <section className="p-5 border-b border-border shrink-0">
        <h2 className="text-[10px] font-medium text-muted uppercase tracking-wider mb-3">Length</h2>
        <div className="text-sm font-mono tabular-nums text-body">
          <span className="text-heading">{nf.format(length.words)}</span>
          <span className="text-muted"> / {length.target ? nf.format(length.target) : '—'} words</span>
        </div>
        <div className="relative mt-2 h-1.5 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
          <div className={`h-full rounded-full ${lengthColor}`} style={{ width: `${Math.min(length.ratio ?? 0, 1) * 100}%` }} />
        </div>
        <p className="text-xs text-muted mt-2">{lengthNote}</p>
      </section>

      {/* Guideline check */}
      <section className="p-5 border-b border-border shrink-0 relative">
        <h2 className="text-[10px] font-medium text-muted uppercase tracking-wider mb-4">Guideline check</h2>
        {result ? (
          <div className="flex flex-col items-center mb-4">
            <ScoreGauge score={result.overallScore} size={120} />
            <p className="text-xs text-muted mt-3 font-mono">{result.guidelineCount} rules evaluated</p>
          </div>
        ) : (
          <p className="text-xs text-muted mb-4">Checks the draft against this client’s guidelines, including the “sounds human” rules.</p>
        )}
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="w-full bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-input text-sm font-medium transition-all shadow-glow-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checking ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> {result ? 'Check again' : 'Check against guidelines'}
            </>
          )}
        </button>
        {result && result.dimensionScores.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {result.dimensionScores.map((d) => (
              <li key={d.category}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-body truncate">{d.category}</span>
                  <span className="font-mono tabular-nums text-muted">{d.score}</span>
                </div>
                <div className="h-1 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
                  <div className={`h-full rounded-full ${d.score >= 70 ? 'bg-green-500' : d.score >= 50 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${d.score}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {result && result.dropped > 0 && (
          <p className="text-[11px] text-muted mt-3">{result.dropped} suggestion{result.dropped === 1 ? '' : 's'} skipped: the quoted text wasn’t in the draft.</p>
        )}
      </section>

      {/* Suggestions */}
      <section className="shrink-0">
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-heading font-display text-lg flex items-center gap-2">
              Suggestions
              <span className="bg-surface text-muted px-2 py-0.5 rounded-full text-xs font-mono tabular-nums border border-border">{filtered.length}</span>
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
        <div className="px-5 pb-6 space-y-4">
          {filtered.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              isActive={activeSuggestionId === s.id}
              isExpanded={expandedId === s.id}
              recomposeUrl={`${base}/recompose`}
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
            <div className="text-center py-4 space-y-2">
              <ListChecks className="w-6 h-6 text-muted mx-auto" />
              <p className="text-sm text-muted">{result ? 'No issues found.' : 'Run the guideline check to get suggestions for this draft.'}</p>
            </div>
          )}
          {all.length > 0 && filtered.length === 0 && <p className="text-sm text-muted text-center py-4">Nothing here.</p>}
        </div>
      </section>
    </div>
  )
}
