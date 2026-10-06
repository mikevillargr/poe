'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Copy, ExternalLink, ChevronDown, LayoutTemplate } from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import type { GenerationMeta } from '@/lib/db/schema/articles'

// DR-012 "Template run": live steps while a templated draft generates (Profound-style checklist), then
// the result: checks (failed first), meta title/description with limits, links used/dropped, and
// "Mark checks reviewed" for drafts that still fail checks after the retry.

export interface RunStep {
  step: string
  label: string
}

const nf = new Intl.NumberFormat('en-US')
const sectionCls = 'text-[10px] font-medium text-muted uppercase tracking-wider mb-2'

function MetaField({ label, value, max }: { label: string; value?: string; max: number }) {
  const { toast } = useToast()
  if (!value) return null
  const over = value.length > max
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`font-mono tabular-nums ${over ? 'text-red-400' : 'text-muted'}`}>
          {value.length}/{max}
        </span>
      </div>
      <div className="group relative text-sm text-body bg-surface border border-border rounded-input px-3 py-2 pr-8">
        {value}
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value).then(() => toast.success(`${label} copied`))}
          className="absolute top-2 right-2 p-0.5 text-muted hover:text-heading opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={`Copy ${label}`}
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

export function TemplateRunPanel({
  clientId,
  articleId,
  meta,
  running,
  steps,
  onMetaChange,
}: {
  clientId: string
  articleId: string
  meta: GenerationMeta | null
  running: boolean
  steps: RunStep[]
  onMetaChange: (meta: GenerationMeta) => void
}) {
  const [showPassed, setShowPassed] = useState(false)
  const [showDropped, setShowDropped] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  if (running) {
    return (
      <div className="p-5 space-y-4">
        <div className={sectionCls}>Generating with the template</div>
        <ol className="space-y-2">
          {steps.length === 0 && (
            <li className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="w-4 h-4 animate-spin text-accent" /> Starting…
            </li>
          )}
          {steps.map((s, i) => {
            const current = i === steps.length - 1
            return (
              <li
                key={`${s.step}-${i}`}
                className={`flex items-center gap-2.5 text-sm rounded-input border px-3 py-2 ${
                  current ? 'border-accent/40 bg-accent/5 text-heading' : 'border-border text-body'
                }`}
              >
                {current ? <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-success shrink-0" />}
                {s.label}
              </li>
            )
          })}
        </ol>
        <p className="text-xs text-muted">Saved when it finishes, even if you leave.</p>
      </div>
    )
  }

  if (!meta) {
    return (
      <div className="p-5 text-sm text-muted">
        <LayoutTemplate className="w-5 h-5 text-accent mb-2" />
        Generate a draft to see the template’s checks, meta title and description, and the internal links it used.
      </div>
    )
  }

  const failed = meta.checks.filter((c) => !c.ok)
  const passed = meta.checks.filter((c) => c.ok)

  async function markReviewed() {
    setReviewing(true)
    try {
      const d = await apiFetch<{ generationMeta: GenerationMeta }>(`/api/clients/${clientId}/articles/${articleId}/template/review`, {
        method: 'POST',
        errorTitle: 'Couldn’t mark the checks reviewed',
      })
      onMetaChange(d.generationMeta)
    } catch {
      // toasted
    } finally {
      setReviewing(false)
    }
  }

  return (
    <div className="p-5 space-y-6">
      {/* Summary */}
      <div
        className={`rounded-card border p-4 ${
          meta.needsReview ? 'border-warning/40 bg-warning/10' : failed.length ? 'border-border bg-surface' : 'border-success/30 bg-success/10'
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-heading">
          {meta.needsReview ? (
            <AlertTriangle className="w-4 h-4 text-orange-400" />
          ) : (
            <CheckCircle2 className={`w-4 h-4 ${failed.length ? 'text-muted' : 'text-green-400'}`} />
          )}
          {meta.needsReview
            ? `Needs review: ${failed.length} ${failed.length === 1 ? 'check' : 'checks'} failing`
            : `${nf.format(passed.length)} of ${nf.format(meta.checks.length)} checks passed`}
        </div>
        <p className="text-xs text-muted mt-1">
          {meta.retried ? 'Rewritten once to fix failed checks. ' : ''}
          Revision {meta.revisionNo} · {new Date(meta.generatedAt).toLocaleString()}
          {meta.reviewedBy ? ` · reviewed by ${meta.reviewedBy}` : ''}
        </p>
        {meta.needsReview && (
          <button
            type="button"
            onClick={markReviewed}
            disabled={reviewing}
            className="mt-3 text-xs font-medium px-3 py-1.5 rounded-input border border-border text-heading hover:bg-surface-hover disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {reviewing && <Loader2 className="w-3 h-3 animate-spin" />}
            Mark checks reviewed
          </button>
        )}
      </div>

      {/* Checks */}
      <div>
        <div className={sectionCls}>Checks</div>
        <ul className="space-y-1.5">
          {failed.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm text-body">
              <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
        {passed.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            className="mt-2 text-xs text-muted hover:text-heading inline-flex items-center gap-1"
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${showPassed ? 'rotate-180' : ''}`} />
            {passed.length} passed
          </button>
        )}
        {showPassed && (
          <ul className="space-y-1.5 mt-2">
            {passed.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-xs text-muted">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Meta */}
      {(meta.metaTitle || meta.metaDescription || meta.tldr) && (
        <div className="space-y-3">
          <div className={sectionCls}>Meta</div>
          <MetaField label="Meta title" value={meta.metaTitle} max={60} />
          <MetaField label="Meta description" value={meta.metaDescription} max={155} />
          {meta.tldr && <MetaField label="Summary" value={meta.tldr} max={400} />}
        </div>
      )}

      {/* Links */}
      {((meta.selectedLinks?.length ?? 0) > 0 || (meta.droppedLinks?.length ?? 0) > 0) && (
        <div>
          <div className={sectionCls}>Internal links chosen</div>
          <ul className="space-y-1">
            {(meta.selectedLinks ?? []).map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="text-xs text-body hover:text-accent inline-flex items-start gap-1 break-all">
                  <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" /> {u.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
              </li>
            ))}
          </ul>
          {(meta.droppedLinks?.length ?? 0) > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowDropped((v) => !v)}
                className="mt-2 text-xs text-muted hover:text-heading inline-flex items-center gap-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${showDropped ? 'rotate-180' : ''}`} />
                {meta.droppedLinks!.length} dropped (not in the client’s link lists)
              </button>
              {showDropped && (
                <ul className="mt-1 space-y-1">
                  {meta.droppedLinks!.map((u) => (
                    <li key={u} className="text-xs text-muted line-through break-all">
                      {u}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Run details */}
      <div className="text-xs text-muted space-y-1">
        {meta.ctaStyle && <div>CTA style: {meta.ctaStyle.split(':')[0]}</div>}
        {meta.models?.utility && <div className="font-mono">Links: {meta.models.utility}</div>}
        {meta.models?.generation && <div className="font-mono">Writer: {meta.models.generation}</div>}
      </div>
    </div>
  )
}
