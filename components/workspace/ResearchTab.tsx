'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Loader2, BookOpen, PenLine, Sparkles, AlertCircle, RefreshCw, ExternalLink, Check, Square } from 'lucide-react'
import type { Citation } from '@/lib/ai/types'
import type { ResearchEdit, WorkspaceResearch } from '@/lib/pipeline/schemas'
import { OutlineEditor } from './OutlineEditor'
import { RunActivity } from '@/components/runs/RunActivity'
import type { ActivityState } from '@/lib/ai/client/activity'
import { hasResearch, type ModelsInUse, type WorkspaceArticle } from './types'

const nf = new Intl.NumberFormat('en-US')

export interface ResearchStreamState {
  active: boolean
  searches: string[]
  citations: Citation[]
  text: string
  saving: boolean
  /** Running on the server but not streamed to this page (we returned to it): no live detail. */
  remote: boolean
  /** DR-016: live phase, feed and thinking. */
  activity: ActivityState
  /** Typical research time for the configured model (null: no estimate). */
  estimateMs: number | null
}

function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function Phase({ label, state }: { label: string; state: 'todo' | 'active' | 'done' }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {state === 'done' ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : state === 'active' ? (
        <Loader2 className="w-4 h-4 text-accent animate-spin" />
      ) : (
        <span className="w-4 h-4 rounded-full border border-border inline-block" />
      )}
      <span className={state === 'todo' ? 'text-muted' : 'text-heading'}>{label}</span>
    </li>
  )
}

// DR-005 Research tab: run research (live phases), then edit summary, outline and sources, then
// the big "Generate draft" CTA.
export function ResearchTab({
  article,
  models,
  stream,
  generating,
  onRun,
  onStop,
  onEdit,
  onGenerate,
}: {
  article: WorkspaceArticle
  models: ModelsInUse
  stream: ResearchStreamState
  generating: boolean
  onRun: () => void
  onStop: () => void
  onEdit: (edit: ResearchEdit, next: WorkspaceResearch) => void
  onGenerate: (useResearch: boolean) => void
}) {
  const research = article.research
  const ready = hasResearch(article)
  const [summary, setSummary] = useState(research?.summary ?? '')
  const [outlineKey, setOutlineKey] = useState(0)
  const [useResearch, setUseResearch] = useState(true)

  // New research arrived (or another article): reset local editors from the saved brief.
  useEffect(() => {
    setSummary(research?.summary ?? '')
    setOutlineKey((k) => k + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id, research?.queries?.join('|'), research?.citations?.length, stream.active])

  const target = article.targetWordCount
  const busy = stream.active || generating

  if (stream.active) {
    return (
      <div className="max-w-3xl mx-auto p-8 space-y-6">
        <div className="glass-card p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-display text-heading">Researching…</h2>
              <p className="text-xs text-muted font-mono mt-1">{models.research ?? 'research model'}</p>
            </div>
            <button
              type="button"
              onClick={onStop}
              className="px-3 py-1.5 rounded-input text-xs border border-border text-muted hover:text-heading hover:bg-surface-hover flex items-center gap-1.5"
            >
              <Square className="w-3 h-3" /> Stop
            </button>
          </div>
          <RunActivity
            kind="research"
            activity={stream.activity}
            startedAt={article.researchStartedAt}
            model={models.research}
            estimateMs={stream.estimateMs}
            remote={stream.remote}
            showModel={false}
          />
          {stream.saving && (
            <p className="mt-3 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Saving research…
            </p>
          )}
        </div>
        <p className="text-xs text-muted text-center">Research keeps running if you leave this page, and is saved when it finishes.</p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="max-w-2xl mx-auto p-8">
        <div className="glass-card p-10 text-center space-y-4">
          {article.researchStatus === 'error' ? (
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          ) : (
            <BookOpen className="w-8 h-8 text-accent mx-auto" />
          )}
          <h2 className="text-xl font-display text-heading">
            {article.researchStatus === 'error' ? 'Research failed' : 'Research the topic first'}
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            {article.researchStatus === 'error'
              ? 'The last research run didn’t finish. Try again.'
              : 'Searches the live web for the keywords and brief, then gives you a cited summary and an outline to edit before drafting.'}
          </p>
          <button
            type="button"
            onClick={onRun}
            disabled={busy}
            className="bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-input text-sm font-medium inline-flex items-center gap-2 transition-all hover:shadow-glow-accent-strong disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            Run research
          </button>
          <p className="text-xs text-muted font-mono">{models.research ?? 'No research model configured'}</p>
        </div>
        <GenerateCta target={target} model={models.generation} disabled={busy} generating={generating} withResearch={false} onGenerate={() => onGenerate(false)} />
      </div>
    )
  }

  const citations = research!.citations
  const excludedIds = citations.filter((c) => c.excluded).map((c) => c.id)
  const toggle = (id: string) => {
    const next = excludedIds.includes(id) ? excludedIds.filter((x) => x !== id) : [...excludedIds, id]
    onEdit(
      { excludedCitationIds: next },
      { ...research!, citations: citations.map((c) => ({ ...c, excluded: next.includes(c.id) || undefined })) },
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-muted font-mono tabular-nums">
          {research!.queries.length} search{research!.queries.length === 1 ? '' : 'es'} · {citations.length} source
          {citations.length === 1 ? '' : 's'}
          {article.researchModel && <> · {article.researchModel}</>}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="px-3 py-1.5 rounded-input text-xs border border-border text-muted hover:text-heading hover:bg-surface-hover flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className="w-3 h-3" /> Re-run research
        </button>
      </div>

      <section>
        <h3 className="text-lg font-display text-heading mb-3">Summary</h3>
        <textarea
          value={summary}
          disabled={busy}
          onChange={(e) => {
            setSummary(e.target.value)
            onEdit({ summary: e.target.value }, { ...research!, summary: e.target.value })
          }}
          rows={8}
          aria-label="Research summary"
          className="w-full px-4 py-3 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-card text-body text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y"
        />
        <p className="text-xs text-muted mt-1">[n] markers refer to the numbered sources below.</p>
      </section>

      <section>
        <h3 className="text-lg font-display text-heading mb-3">Outline</h3>
        <OutlineEditor
          key={outlineKey}
          html={research!.outlineHtml ?? ''}
          disabled={busy}
          onChange={(html) => onEdit({ outlineHtml: html }, { ...research!, outlineHtml: html })}
        />
      </section>

      <section>
        <h3 className="text-lg font-display text-heading mb-3">
          Sources{' '}
          <span className="text-sm font-sans text-muted font-mono tabular-nums">
            {citations.length - excludedIds.length} of {citations.length} included
          </span>
        </h3>
        {citations.length === 0 ? (
          <p className="text-sm text-muted">No sources were returned.</p>
        ) : (
          <ol className="space-y-2">
            {citations.map((c, i) => (
              <li key={c.id} className={`glass-card p-3 flex items-start gap-3 transition-opacity ${c.excluded ? 'opacity-50' : ''}`}>
                <span className="font-mono tabular-nums text-xs text-muted w-6 shrink-0 pt-0.5">[{c.id || i + 1}]</span>
                <div className="min-w-0 flex-1">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-heading hover:text-accent inline-flex items-center gap-1 max-w-full"
                  >
                    <span className="truncate">{c.title || c.url}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <div className="text-xs text-muted">{domainOf(c.url)}</div>
                  {c.snippet && <p className="text-xs text-body mt-1 line-clamp-2">{c.snippet}</p>}
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!c.excluded}
                    disabled={busy}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  Include
                </label>
              </li>
            ))}
          </ol>
        )}
      </section>

      <GenerateCta
        target={target}
        model={models.generation}
        disabled={busy}
        generating={generating}
        withResearch
        useResearch={useResearch}
        onToggleResearch={setUseResearch}
        onGenerate={() => onGenerate(useResearch)}
      />
    </div>
  )
}

function GenerateCta({
  target,
  model,
  disabled,
  generating,
  withResearch,
  useResearch,
  onToggleResearch,
  onGenerate,
}: {
  target: number | null
  model: string | null
  disabled: boolean
  generating: boolean
  withResearch: boolean
  useResearch?: boolean
  onToggleResearch?: (v: boolean) => void
  onGenerate: () => void
}) {
  return (
    <div className="glass-card p-6 mt-6 flex flex-col items-center text-center gap-3">
      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled}
        className="bg-accent hover:bg-accent/90 text-white px-8 py-3 rounded-input text-base font-medium inline-flex items-center gap-2 transition-all shadow-glow-accent hover:shadow-glow-accent-strong disabled:opacity-50"
      >
        {generating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        Generate draft
        {target ? <span className="font-mono tabular-nums text-white/80 text-sm">· {nf.format(target)} words</span> : null}
      </button>
      <p className="text-xs text-muted font-mono">{model ?? 'No generation model configured'}</p>
      {withResearch ? (
        <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
          <input
            type="checkbox"
            checked={!!useResearch}
            onChange={(e) => onToggleResearch?.(e.target.checked)}
            className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
          />
          Use this research (summary, outline and included sources)
        </label>
      ) : (
        <p className="text-xs text-muted flex items-center gap-1.5">
          <PenLine className="w-3 h-3" />
          No research yet. The draft will rely on the model’s own knowledge.
        </p>
      )}
    </div>
  )
}
