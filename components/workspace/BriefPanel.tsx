'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star, X, Plus, Cpu, Search as SearchIcon, PenLine, Settings2 } from 'lucide-react'
import { splitKeywords } from '@/lib/articles/schemas'
import type { ModelsInUse, WorkspaceArticle, WorkspacePerson } from './types'

// DR-005 left panel: brief, SEO keywords (primary starred), target words, owner, models. Every
// field autosaves through the workspace's debounced PATCH.

export interface BriefPatch {
  brief?: string | null
  keywords?: string[]
  primaryKeyword?: string | null
  targetWordCount?: number | null
  assigneeId?: string | null
}

const inputCls =
  'w-full px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-heading placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all'

const labelCls = 'block text-[10px] font-medium text-muted uppercase tracking-wider mb-2'

function primaryOf(a: Pick<WorkspaceArticle, 'primaryKeyword' | 'keywords'>) {
  return a.primaryKeyword || a.keywords[0] || null
}

/** Primary first, the rest in order. */
function withPrimaryFirst(keywords: string[], primary: string | null) {
  if (!primary) return keywords
  const rest = keywords.filter((k) => k.toLowerCase() !== primary.toLowerCase())
  return [primary, ...rest]
}

function ModelRow({ icon: Icon, label, value, note }: { icon: typeof Cpu; label: string; value: string | null; note?: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-muted">{label}</div>
        <div className="font-mono text-body truncate" title={value ?? undefined}>
          {value ?? 'Not configured'}
        </div>
        {note && <div className="text-muted/80">{note}</div>}
      </div>
    </div>
  )
}

export function BriefPanel({
  article,
  people,
  models,
  isSuperAdmin,
  disabled,
  onChange,
}: {
  article: WorkspaceArticle
  people: WorkspacePerson[]
  models: ModelsInUse
  isSuperAdmin: boolean
  /** While research/generation is streaming, the brief is read-only. */
  disabled?: boolean
  onChange: (patch: BriefPatch) => void
}) {
  const [brief, setBrief] = useState(article.brief ?? '')
  const [target, setTarget] = useState(article.targetWordCount ? String(article.targetWordCount) : '')
  const [draftKeyword, setDraftKeyword] = useState('')

  // Re-sync when another article is opened.
  useEffect(() => {
    setBrief(article.brief ?? '')
    setTarget(article.targetWordCount ? String(article.targetWordCount) : '')
    setDraftKeyword('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  const primary = primaryOf(article)
  const keywords = withPrimaryFirst(article.keywords, primary)

  function setKeywords(next: string[], nextPrimary: string | null) {
    const ordered = withPrimaryFirst(next, nextPrimary)
    onChange({ keywords: ordered, primaryKeyword: ordered[0] ?? null })
  }

  function addKeywords() {
    const added = splitKeywords(draftKeyword)
    if (!added.length) return
    const merged = splitKeywords([...keywords, ...added])
    setKeywords(merged, primary ?? merged[0] ?? null)
    setDraftKeyword('')
  }

  function removeKeyword(k: string) {
    const next = keywords.filter((x) => x !== k)
    setKeywords(next, k === primary ? next[0] ?? null : primary)
  }

  const targetError =
    target && (!/^\d+$/.test(target) || Number(target) < 50 || Number(target) > 20000) ? 'Between 50 and 20,000 words.' : null

  return (
    <div className="p-5 space-y-6">
      <div>
        <label htmlFor="ws-brief" className={labelCls}>
          Brief
        </label>
        <textarea
          id="ws-brief"
          value={brief}
          disabled={disabled}
          onChange={(e) => {
            setBrief(e.target.value)
            onChange({ brief: e.target.value.trim() ? e.target.value : null })
          }}
          rows={7}
          maxLength={10000}
          placeholder="What the article should cover, the angle, the audience…"
          className={`${inputCls} resize-y min-h-[120px] leading-relaxed disabled:opacity-60`}
        />
      </div>

      <div>
        <div className={labelCls}>
          SEO keywords <span className="font-mono tabular-nums normal-case tracking-normal">· {keywords.length}</span>
        </div>
        {keywords.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 mb-2">
            {keywords.map((k) => {
              const isPrimary = k === primary
              return (
                <li
                  key={k}
                  className={`group inline-flex items-center gap-1 pl-1.5 pr-1 py-1 rounded-md text-xs border ${
                    isPrimary ? 'bg-accent/10 border-accent/30 text-heading' : 'bg-surface border-border text-body'
                  }`}
                >
                  <button
                    type="button"
                    disabled={disabled || isPrimary}
                    onClick={() => setKeywords(keywords, k)}
                    title={isPrimary ? 'Primary keyword' : 'Make primary'}
                    aria-label={isPrimary ? `${k} is the primary keyword` : `Make ${k} the primary keyword`}
                    className="p-0.5 rounded disabled:cursor-default"
                  >
                    <Star className={`w-3 h-3 ${isPrimary ? 'text-accent fill-accent' : 'text-muted group-hover:text-accent'}`} />
                  </button>
                  <span className="max-w-[180px] truncate">{k}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeKeyword(k)}
                    aria-label={`Remove ${k}`}
                    className="p-0.5 rounded text-muted hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted mb-2">No keywords yet. The SEO team’s keywords go here; the first is the primary.</p>
        )}
        <div className="flex gap-2">
          <input
            value={draftKeyword}
            disabled={disabled}
            onChange={(e) => setDraftKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addKeywords()
              }
            }}
            placeholder="Add keyword"
            aria-label="Add keyword"
            className={inputCls}
          />
          <button
            type="button"
            onClick={addKeywords}
            disabled={disabled || !draftKeyword.trim()}
            aria-label="Add keyword"
            className="px-2.5 rounded-input border border-border text-muted hover:text-heading hover:bg-surface-hover disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="ws-target" className={labelCls}>
          Target words
        </label>
        <input
          id="ws-target"
          inputMode="numeric"
          value={target}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, '')
            setTarget(v)
            const n = Number(v)
            if (!v) onChange({ targetWordCount: null })
            else if (n >= 50 && n <= 20000) onChange({ targetWordCount: n })
          }}
          placeholder="e.g. 1500"
          className={`${inputCls} font-mono tabular-nums`}
        />
        {targetError ? (
          <p className="text-xs text-red-400 mt-1">{targetError}</p>
        ) : (
          <p className="text-xs text-muted mt-1">The draft aims for ±10% of this.</p>
        )}
      </div>

      <div>
        <label htmlFor="ws-owner" className={labelCls}>
          Owner
        </label>
        <select
          id="ws-owner"
          value={article.assigneeId ?? ''}
          disabled={disabled}
          onChange={(e) => onChange({ assigneeId: e.target.value || null })}
          className={inputCls}
        >
          <option value="">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className={labelCls}>Models</div>
        <div className="space-y-2.5">
          <ModelRow
            icon={SearchIcon}
            label="Research"
            value={models.research}
            note={article.researchModel && article.researchModel !== models.research ? `Last run: ${article.researchModel}` : undefined}
          />
          <ModelRow
            icon={PenLine}
            label="Generation"
            value={models.generation}
            note={article.draftModel && article.draftModel !== models.generation ? `Draft by: ${article.draftModel}` : undefined}
          />
        </div>
        {isSuperAdmin && (
          <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-muted hover:text-accent mt-3 transition-colors">
            <Settings2 className="w-3 h-3" />
            Change in Settings
          </Link>
        )}
      </div>
    </div>
  )
}
