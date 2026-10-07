'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  ArrowRight,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquareText,
  PenLine,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Undo2,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { apiFetch } from '@/lib/api/fetch'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { EventAvatar } from '@/components/home/ActivityRail'
import { StatusPill } from '@/components/home/StatusPill'
import type { ArticleStatus } from '@/lib/articles/schemas'
import type { ArticleVersionDTO } from '@/lib/pipeline/schemas'
import type { DraftHunk } from '@/lib/articles/draft-diff'
import {
  HISTORY_FILTERS,
  describeHistoryEvent,
  fieldLabel,
  groupByDay,
  historyGroup,
  historyMeta,
  type HistoryData,
  type HistoryEvent,
  type HistoryGroup,
} from '@/lib/articles/history-format'

// DR-020: the article's History, a right-side panel with Activity (who did what, grouped by day, filterable,
// with details and "Show changes") and Versions (saved drafts, Save version, Restore).

export type HistoryTab = 'activity' | 'versions'

const nf = new Intl.NumberFormat('en-US')

const VERSION_KIND: Record<ArticleVersionDTO['kind'], { label: string; icon: typeof Star }> = {
  generated: { label: 'generated', icon: Sparkles },
  manual: { label: 'saved', icon: Star },
  suggestion_applied: { label: 'suggestion', icon: Wand2 },
  restore: { label: 'restore', icon: Undo2 },
  imported: { label: 'imported', icon: Upload },
  revised: { label: 'revised', icon: MessageSquareText },
  edit_checkpoint: { label: 'before edits', icon: PenLine },
}

export function HistoryPanel({
  open,
  tab,
  onTabChange,
  onClose,
  base,
  refreshKey,
  versions,
  versionsLoading,
  onRestore,
  onSaveVersion,
}: {
  open: boolean
  tab: HistoryTab
  onTabChange: (tab: HistoryTab) => void
  onClose: () => void
  /** `/api/clients/:id/articles/:id` */
  base: string
  /** Changes when the article changes, so an open panel refreshes. */
  refreshKey: string
  versions: ArticleVersionDTO[]
  versionsLoading: boolean
  onRestore: (v: ArticleVersionDTO) => Promise<void>
  onSaveVersion: (label: string) => Promise<void>
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="alertdialog"],[aria-modal="true"]') && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          role="dialog"
          aria-label="Article history"
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed top-4 right-4 bottom-4 z-50 w-[460px] max-w-[calc(100vw-2rem)] glass-card bg-surface shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="px-5 pt-4 border-b border-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-accent" />
              <h2 className="text-base font-display text-heading flex-1">History</h2>
              <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div role="tablist" className="flex gap-4 mt-2 -mb-px">
              {(['activity', 'versions'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => onTabChange(t)}
                  className={`pb-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-accent text-heading font-medium' : 'border-transparent text-muted hover:text-heading'}`}
                >
                  {t === 'activity' ? 'Activity' : 'Versions'}
                  {t === 'versions' && versions.length > 0 && <span className="ml-1.5 font-mono tabular-nums text-xs text-muted">{versions.length}</span>}
                </button>
              ))}
            </div>
          </div>
          {tab === 'activity' ? (
            <ActivityTab base={base} refreshKey={refreshKey} />
          ) : (
            <VersionsTab versions={versions} loading={versionsLoading} onRestore={onRestore} onSave={onSaveVersion} />
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

// ── Activity ──────────────────────────────────────────────────────────────────────────────────

function ActivityTab({ base, refreshKey }: { base: string; refreshKey: string }) {
  const [data, setData] = useState<HistoryData | null>(null)
  const [failed, setFailed] = useState(false)
  const [group, setGroup] = useState<HistoryGroup | 'all'>('all')
  const [person, setPerson] = useState<string>('all')

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<HistoryData>(`${base}/history`, { errorTitle: 'Couldn’t load history' }))
      setFailed(false)
    } catch {
      setFailed(true)
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const people = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of data?.events ?? []) if (e.userId) m.set(e.userId, e.userName ?? 'Someone')
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 }
    for (const e of data?.events ?? []) {
      if (person !== 'all' && e.userId !== person) continue
      c.all++
      const g = historyGroup(e.type)
      c[g] = (c[g] ?? 0) + 1
    }
    return c
  }, [data, person])

  const visible = useMemo(
    () => (data?.events ?? []).filter((e) => (group === 'all' || historyGroup(e.type) === group) && (person === 'all' || e.userId === person)),
    [data, group, person],
  )
  const days = useMemo(() => groupByDay(visible), [visible])

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm gap-2">
        {failed ? (
          <button type="button" onClick={() => void load()} className="text-accent hover:underline">
            Try again
          </button>
        ) : (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
      </div>
    )
  }

  return (
    <>
      <div className="px-5 py-3 border-b border-border space-y-2">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Show">
          {HISTORY_FILTERS.map((f) => {
            const n = counts[f.id] ?? 0
            const on = group === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setGroup(f.id)}
                disabled={!on && n === 0 && f.id !== 'all'}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors disabled:opacity-40 ${
                  on ? 'border-accent/40 bg-accent/10 text-accent' : 'border-border text-muted hover:text-heading hover:bg-surface-hover'
                }`}
              >
                {f.label}
                <span className="ml-1 font-mono tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
        {people.length > 1 && (
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label="Person"
            className="w-full bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-2.5 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <option value="all">Everyone</option>
            {people.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-4">
        {days.length === 0 ? (
          <p className="text-sm text-muted py-10 text-center">{data.events.length ? 'Nothing matches these filters.' : 'No activity yet.'}</p>
        ) : (
          days.map((d) => (
            <section key={d.label}>
              <h3 className="sticky top-0 z-10 bg-surface pt-4 pb-2 text-[11px] uppercase tracking-wider text-muted">{d.label}</h3>
              <ol className="space-y-1">
                {d.events.map((e) => (
                  <ActivityRow key={e.id} e={e} people={data.people} base={base} />
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <OriginFooter data={data} />
    </>
  )
}

function hasDetail(e: HistoryEvent): boolean {
  const p = e.payload ?? {}
  switch (e.type) {
    case 'fields_edited':
      return ((p.changes as unknown[] | undefined) ?? []).length > 0
    case 'suggestion_accepted':
    case 'suggestion_dismissed':
    case 'suggestion_restored':
    case 'suggestion_reworded':
      return !!p.original || !!p.suggested
    case 'ai_edit_applied':
      return !!p.replacement
    case 'revised':
      return !!p.feedback
    case 'draft_edited':
      return !!p.checkpointVersionNo
    default:
      return false
  }
}

function ActivityRow({ e, people, base }: { e: HistoryEvent; people: Record<string, string>; base: string }) {
  const [open, setOpen] = useState(false)
  const detail = hasDetail(e)
  const meta = historyMeta(e)
  const p = e.payload ?? {}

  return (
    <li className="rounded-lg -mx-2 px-2 py-2 hover:bg-surface-hover/60 transition-colors">
      <div className="flex items-start gap-3">
        <EventAvatar name={e.userName} image={e.userImage} />
        <div className="min-w-0 flex-1 text-sm leading-snug">
          <div className="flex items-start gap-2">
            <p className="flex-1 min-w-0">
              <span className="text-heading font-medium">{e.userName ?? 'Poe'}</span> <span className="text-body">{describeHistoryEvent(e, people)}</span>
            </p>
            <time dateTime={e.at} title={format(new Date(e.at), 'PPpp')} className="text-xs text-muted font-mono tabular-nums shrink-0 pt-0.5">
              {format(new Date(e.at), 'h:mm a')}
            </time>
          </div>

          {e.type === 'status_changed' && e.fromStatus && e.toStatus && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <StatusPill status={e.fromStatus as ArticleStatus} />
              <ArrowRight className="w-3 h-3 text-muted" />
              <StatusPill status={e.toStatus as ArticleStatus} />
            </div>
          )}
          {e.type === 'assigned' && p.reason !== 'started generation' && (
            <FromTo from={typeof p.from === 'string' ? (people[p.from] ?? 'someone') : 'No owner'} to={typeof p.to === 'string' ? (people[p.to] ?? 'someone') : 'No owner'} />
          )}
          {e.type === 'exported' && typeof p.url === 'string' && (
            <a href={p.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline">
              Open the Doc <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {(meta || detail) && (
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
              {meta && <span className="truncate">{meta}</span>}
              {detail && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-accent hover:underline"
                >
                  {e.type === 'draft_edited' ? 'Show changes' : 'Details'}
                  <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
          )}

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <Detail e={e} base={base} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </li>
  )
}

function FromTo({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
      <span className="px-2 py-0.5 rounded-full border border-border text-muted line-through decoration-muted/60 max-w-[45%] truncate">{from}</span>
      <ArrowRight className="w-3 h-3 text-muted shrink-0" />
      <span className="px-2 py-0.5 rounded-full border border-accent/30 bg-accent/5 text-heading max-w-[45%] truncate">{to}</span>
    </div>
  )
}

function shown(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'empty'
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'empty'
  if (typeof v === 'number') return nf.format(v)
  return String(v)
}

function Quote({ tone, label, text }: { tone: 'before' | 'after' | 'note'; label: string; text: string }) {
  const cls =
    tone === 'before'
      ? 'border-danger/40 bg-danger/5 text-body'
      : tone === 'after'
        ? 'border-success/50 bg-success/5 text-heading'
        : 'border-border bg-[var(--color-editor-bg)] text-body'
  return (
    <div className={`border-l-2 rounded-r px-2.5 py-1.5 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wider text-muted mb-0.5">{label}</p>
      <p className="text-xs whitespace-pre-wrap line-clamp-6">{text}</p>
    </div>
  )
}

function Detail({ e, base }: { e: HistoryEvent; base: string }) {
  const p = e.payload ?? {}
  switch (e.type) {
    case 'fields_edited': {
      const changes = (p.changes as { field: string; from: unknown; to: unknown }[] | undefined) ?? []
      return (
        <div className="space-y-2">
          {changes.map((c) =>
            c.field === 'brief' ? (
              <div key={c.field} className="space-y-1">
                <p className="text-xs text-muted">Brief</p>
                <Quote tone="before" label="Before" text={shown(c.from)} />
                <Quote tone="after" label="After" text={shown(c.to)} />
              </div>
            ) : (
              <div key={c.field}>
                <p className="text-xs text-muted capitalize">{fieldLabel(c.field)}</p>
                <FromTo from={shown(c.from)} to={shown(c.to)} />
              </div>
            ),
          )}
        </div>
      )
    }
    case 'suggestion_accepted':
    case 'suggestion_dismissed':
    case 'suggestion_restored':
    case 'suggestion_reworded':
      return (
        <div className="space-y-1">
          {typeof p.category === 'string' && <p className="text-xs text-muted capitalize">{p.category} rule</p>}
          {typeof p.original === 'string' && p.original && <Quote tone="before" label="Original" text={p.original} />}
          {typeof p.suggested === 'string' && p.suggested && (
            <Quote tone={e.type === 'suggestion_dismissed' ? 'note' : 'after'} label={e.type === 'suggestion_dismissed' ? 'Suggested (not applied)' : 'Applied'} text={p.suggested} />
          )}
        </div>
      )
    case 'ai_edit_applied':
      return (
        <div className="space-y-1">
          {typeof p.instruction === 'string' && p.instruction && <Quote tone="note" label="Instruction" text={p.instruction} />}
          {typeof p.original === 'string' && p.original && <Quote tone="before" label="Before" text={p.original} />}
          <Quote tone="after" label={p.mode === 'insert' ? 'Inserted' : 'After'} text={String(p.replacement ?? '')} />
        </div>
      )
    case 'revised':
      return <Quote tone="note" label="Feedback" text={String(p.feedback ?? '')} />
    case 'draft_edited':
      return <DraftChanges base={base} eventId={e.id} />
    default:
      return null
  }
}

function DraftChanges({ base, eventId }: { base: string; eventId: string }) {
  const [res, setRes] = useState<{ hunks: DraftHunk[]; endsAt: string } | null | 'error'>(null)
  useEffect(() => {
    apiFetch<{ hunks: DraftHunk[]; endsAt: string }>(`${base}/history/changes?event=${eventId}`, { errorTitle: 'Couldn’t load the changes' })
      .then(setRes)
      .catch(() => setRes('error'))
  }, [base, eventId])

  if (res === null) return <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
  if (res === 'error') return <p className="text-xs text-muted">Changes aren’t available.</p>
  if (!res.hunks.some((h) => h.type !== 'same' && h.type !== 'skip')) return <p className="text-xs text-muted">No visible text changes (formatting only).</p>

  return (
    <div className="rounded-input border border-border bg-[var(--color-editor-bg)] p-2.5 space-y-1.5 text-xs leading-relaxed max-h-72 overflow-y-auto custom-scrollbar">
      {res.hunks.map((h, i) => {
        if (h.type === 'skip') return <p key={i} className="text-muted italic text-[11px]">… {h.count} unchanged paragraph{h.count === 1 ? '' : 's'}</p>
        if (h.type === 'same') return <p key={i} className="text-muted line-clamp-2">{h.text}</p>
        if (h.type === 'add') return <p key={i} className="bg-success/10 text-heading rounded px-1">{h.text}</p>
        if (h.type !== 'edit') return <p key={i} className="bg-danger/10 text-muted line-through rounded px-1">{h.text}</p>
        return (
          <p key={i} className="text-body">
            {h.parts.map((w, k) =>
              w.type === 'same' ? (
                <span key={k}>{w.text} </span>
              ) : w.type === 'add' ? (
                <span key={k} className="bg-success/15 text-heading rounded-sm">{w.text} </span>
              ) : (
                <span key={k} className="bg-danger/10 text-muted line-through rounded-sm">{w.text} </span>
              ),
            )}
          </p>
        )
      })}
      <p className="text-[11px] text-muted pt-1 border-t border-border">Compared with the {res.endsAt}.</p>
    </div>
  )
}

function OriginFooter({ data }: { data: HistoryData }) {
  const o = data.origin
  const when = format(new Date(o.createdAt), 'MMM d, yyyy')
  let text: string
  if (o.sheetRow !== null) text = `Synced from a Google Sheet (row ${o.sheetRow})`
  else if (o.importFilename) text = `Imported from ${o.importFilename}`
  else text = 'Added'
  return (
    <div className="px-5 py-3 border-t border-border text-xs text-muted flex items-center gap-2">
      <FileText className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">
        {text}
        {o.createdByName ? ` by ${o.createdByName}` : ''} · {when}
      </span>
    </div>
  )
}

// ── Versions ──────────────────────────────────────────────────────────────────────────────────

function VersionsTab({
  versions,
  loading,
  onRestore,
  onSave,
}: {
  versions: ArticleVersionDTO[]
  loading: boolean
  onRestore: (v: ArticleVersionDTO) => Promise<void>
  onSave: (label: string) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirming, setConfirming] = useState<ArticleVersionDTO | null>(null)
  const sorted = useMemo(() => [...versions].sort((a, b) => b.versionNo - a.versionNo), [versions])

  async function save() {
    if (saving) return
    setSaving(true)
    try {
      await onSave(label.trim())
      setLabel('')
    } catch {
      // the host toasts
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="px-5 py-3 border-b border-border flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void save()}
          maxLength={120}
          placeholder="Label (optional), e.g. Before client edits"
          aria-label="Version label"
          className="flex-1 min-w-0 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input px-3 py-1.5 text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="bg-accent hover:bg-accent/90 text-white px-3 py-1.5 rounded-input text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Save version
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
        {loading && !versions.length ? (
          <div className="flex justify-center py-10 text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 px-6">
            No versions yet. One is saved on every generation, restore and editing session, and whenever you save one.
          </p>
        ) : (
          <ol className="space-y-1">
            {sorted.map((v) => {
              const meta = VERSION_KIND[v.kind]
              const Icon = meta.icon
              return (
                <li key={v.id} className="group flex items-start gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-hover/60">
                  <span className="font-mono tabular-nums text-xs text-muted w-8 pt-0.5">v{v.versionNo}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 shrink-0 text-accent ${v.kind === 'manual' ? 'fill-accent' : ''}`} />
                      <span className="text-sm text-heading truncate">{v.label || 'Version'}</span>
                      <span className="text-[10px] text-muted px-1.5 py-0.5 rounded-full border border-border shrink-0">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span title={format(new Date(v.createdAt), 'PPpp')}>{format(new Date(v.createdAt), 'MMM d, h:mm a')}</span>
                      {v.wordCount !== null && <span className="font-mono tabular-nums">{nf.format(v.wordCount)} words</span>}
                      {v.createdByName && <span className="truncate">{v.createdByName}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirming(v)}
                    className="p-1.5 rounded text-muted hover:text-accent hover:bg-surface-hover opacity-60 group-hover:opacity-100 focus:opacity-100"
                    title="Restore this version"
                    aria-label={`Restore version ${v.versionNo}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
      <ConfirmModal
        isOpen={!!confirming}
        title={`Restore v${confirming?.versionNo ?? ''}?`}
        message="The current draft is saved as a version first, so nothing is lost. Then this version becomes the draft."
        confirmLabel="Restore version"
        confirmVariant="warning"
        onConfirm={() => {
          const v = confirming
          setConfirming(null)
          if (v) void onRestore(v).catch(() => {})
        }}
        onCancel={() => setConfirming(null)}
      />
    </>
  )
}
