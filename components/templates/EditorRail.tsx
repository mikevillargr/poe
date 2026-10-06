'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Eye, Link2, Sparkles, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { apiFetch, ApiFetchError } from '@/lib/api/fetch'
import { listPlaceholders } from '@/lib/templates/placeholders'
import { HOOK_OUTPUTS } from '@/lib/templates/schema'
import { TEMPLATE_HOOKS } from '@/lib/templates/hooks/registry'
import type { TemplateConfig, ValueSource } from '@/lib/templates/types'
import type { ArticleSummary } from '@/lib/articles/schemas'
import { StreamingPreview } from '@/components/workspace/StreamingPreview'
import { inputCls } from './fields'

// DR-010 right rail: where every placeholder's value comes from (n8n-style), and dry runs on the unsaved
// config: Preview prompt (free), Test link step (utility model), Test full draft (writer + checks).

function describe(src: ValueSource, inventories: { slug: string; name: string }[]): string {
  switch (src.from) {
    case 'article':
      return { title: 'Article title', brief: 'Article brief', primaryKeyword: 'Primary keyword' }[src.field]
    case 'keywords':
      return 'Article keywords'
    case 'input':
      return `Row input “${src.key}”`
    case 'wordCount':
      return 'Word count (row, else default)'
    case 'currentYear':
      return 'Current year'
    case 'inventory':
      return `Link list: ${inventories.find((i) => i.slug === src.inventory)?.name ?? src.inventory} (${src.format})`
  }
}

export function PlaceholdersPanel({ config, inventories, unresolved }: { config: TemplateConfig; inventories: { slug: string; name: string }[]; unresolved: Set<string> }) {
  const rows = useMemo(() => {
    const used = [...new Set([config.writerPrompt, ...config.selectors.map((s) => s.prompt)].flatMap(listPlaceholders))]
    return used.map((p) => {
      const value = config.values[p]
      const step = config.selectors.find((s) => s.output === p)
      const hook = config.hooks.find((h) => (HOOK_OUTPUTS[h.id] ?? []).includes(p))
      const source = value
        ? describe(value, inventories)
        : step
          ? `Link step “${step.id}”`
          : hook
            ? `Hook: ${TEMPLATE_HOOKS[hook.id as keyof typeof TEMPLATE_HOOKS]?.label ?? hook.id}`
            : p === 'GUIDELINES'
              ? 'Client guidelines (+ this template’s)'
              : null
      return { p, source }
    })
  }, [config, inventories])

  return (
    <div className="glass-card p-4">
      <div className="text-[10px] font-medium text-muted uppercase tracking-wider mb-3">Placeholders</div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">The prompts use no placeholders.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ p, source }) => (
            <li key={p} className="text-xs">
              <div className={`font-mono ${unresolved.has(p) ? 'text-red-400' : 'text-heading'}`}>{`{{${p}}}`}</div>
              <div className={unresolved.has(p) ? 'text-red-400' : 'text-muted'}>{source ?? 'No source: add one under Placeholder sources'}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

interface DryRunResult {
  mode: 'prompt' | 'links' | 'draft'
  prompt?: string
  html?: string
  checks?: { id: string; ok: boolean; message: string }[]
  needsReview?: boolean
  retried?: boolean
  metaTitle?: string
  metaDescription?: string
  selectedLinks?: string[]
  droppedLinks?: string[]
  models?: { utility?: string; generation?: string }
}

export function DryRunPanel({ clientId, templateId, config, disabled }: { clientId: string; templateId: string; config: TemplateConfig; disabled?: boolean }) {
  const [articles, setArticles] = useState<ArticleSummary[]>([])
  const [sample, setSample] = useState<string>('custom')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [keywords, setKeywords] = useState('')
  const [busy, setBusy] = useState<DryRunResult['mode'] | null>(null)
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch<{ articles: ArticleSummary[] }>(`/api/clients/${clientId}/articles`, { silent: true })
      .then((d) => {
        const mine = d.articles.filter((a) => a.templateId === templateId)
        setArticles([...mine, ...d.articles.filter((a) => a.templateId !== templateId)].slice(0, 50))
        if (mine[0]) setSample(mine[0].id)
      })
      .catch(() => {})
  }, [clientId, templateId])

  async function run(mode: DryRunResult['mode']) {
    setBusy(mode)
    setError(null)
    setResult(null)
    try {
      const body = {
        mode,
        config,
        sample:
          sample === 'custom'
            ? { title: title || undefined, brief: brief || undefined, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean) }
            : { articleId: sample },
      }
      setResult(await apiFetch<DryRunResult>(`/api/clients/${clientId}/templates/${templateId}/dry-run`, { method: 'POST', body, silent: true }))
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : 'Dry run failed.')
    } finally {
      setBusy(null)
    }
  }

  const btn = 'flex-1 px-2.5 py-2 rounded-input text-xs font-medium border border-border text-heading hover:bg-surface-hover disabled:opacity-50 inline-flex items-center justify-center gap-1.5'

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="text-[10px] font-medium text-muted uppercase tracking-wider">Dry run (nothing is saved)</div>
      <select value={sample} onChange={(e) => setSample(e.target.value)} className={`${inputCls} text-xs`} aria-label="Sample row">
        <option value="custom">Custom sample</option>
        {articles.map((a) => (
          <option key={a.id} value={a.id}>
            {a.templateId === templateId ? '● ' : ''}
            {a.title}
          </option>
        ))}
      </select>
      {sample === 'custom' && (
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className={`${inputCls} text-xs`} />
          <input value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Brief (optional)" className={`${inputCls} text-xs`} />
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="Keywords, comma-separated" className={`${inputCls} text-xs`} />
        </div>
      )}
      <div className="flex gap-1.5">
        <button type="button" onClick={() => run('prompt')} disabled={!!busy || disabled} className={btn} title="Fill in the placeholders and show the prompt. No AI call.">
          {busy === 'prompt' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />} Prompt
        </button>
        <button type="button" onClick={() => run('links')} disabled={!!busy || disabled || !config.selectors.length} className={btn} title="Run the link steps with the utility model.">
          {busy === 'links' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />} Links
        </button>
        <button type="button" onClick={() => run('draft')} disabled={!!busy || disabled} className={btn} title="Write a full draft and run the checks. Uses the generation model; nothing is saved.">
          {busy === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Draft
        </button>
      </div>
      {disabled && <p className="text-[11px] text-red-400">Fix the missing placeholder sources first.</p>}
      {busy === 'draft' && <p className="text-[11px] text-muted">Writing a full draft can take a minute or two.</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {result && (
        <div className="space-y-3 border-t border-border pt-3">
          {result.checks && (
            <div className="space-y-1">
              <div className={`text-xs font-medium flex items-center gap-1.5 ${result.needsReview ? 'text-orange-400' : 'text-green-400'}`}>
                {result.needsReview ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {result.checks.filter((c) => c.ok).length} of {result.checks.length} checks passed{result.retried ? ' (after one rewrite)' : ''}
              </div>
              {result.checks
                .filter((c) => !c.ok)
                .map((c) => (
                  <div key={c.id} className="text-[11px] text-body flex items-start gap-1.5">
                    <XCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" /> {c.message}
                  </div>
                ))}
            </div>
          )}
          {(result.selectedLinks?.length ?? 0) > 0 && (
            <div className="text-[11px]">
              <div className="text-muted mb-1">Links chosen</div>
              {result.selectedLinks!.map((u) => (
                <div key={u} className="text-body break-all">
                  {u}
                </div>
              ))}
              {(result.droppedLinks?.length ?? 0) > 0 && <div className="text-muted mt-1">{result.droppedLinks!.length} invented links dropped</div>}
            </div>
          )}
          {result.mode === 'links' && !result.selectedLinks?.length && <p className="text-[11px] text-muted">No links chosen (the link lists may be empty).</p>}
          {result.prompt && (
            <pre className="text-[11px] leading-relaxed text-body bg-background border border-border rounded-input p-3 max-h-[420px] overflow-auto custom-scrollbar whitespace-pre-wrap break-words font-mono">
              {result.prompt}
            </pre>
          )}
          {result.html && (
            <div className="border border-border rounded-input max-h-[480px] overflow-auto custom-scrollbar bg-[var(--color-editor-bg)] [&_.ProseMirror]:min-h-0 [&_.prose]:px-3 [&_.prose]:py-2 [&_.prose]:text-sm">
              <StreamingPreview html={result.html} />
            </div>
          )}
          {result.models && (
            <div className="text-[10px] font-mono text-muted">
              {result.models.utility && <div>Links: {result.models.utility}</div>}
              {result.models.generation && <div>Writer: {result.models.generation}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
