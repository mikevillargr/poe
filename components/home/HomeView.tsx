'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Upload, Search, ExternalLink, FileText, Sparkles, AlertTriangle, Loader2 } from 'lucide-react'
import { arrayMove } from '@dnd-kit/sortable'
import {
  ARTICLE_STATUSES,
  ARTICLE_STATUS_LABELS,
  type ArticleEventDTO,
  type ArticleStatus,
  type ArticleSummary,
  type StatusCounts,
} from '@/lib/articles/schemas'
import { apiFetch } from '@/lib/api/fetch'
import { useToast } from '@/hooks/useToast'
import { ConfirmModal } from '@/components/feedback/ConfirmModal'
import { StatusCards } from './StatusCards'
import { QueueTable, type BatchRow, type BatchState, type Person } from './QueueTable'
import { BulkBar } from './BulkBar'
import { ActivityRail } from './ActivityRail'
import { NewArticleModal } from './NewArticleModal'
import { useClientTemplates } from '@/components/workspace/TemplatePicker'

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } }
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 30 } },
}

export interface HomeClient {
  id: string
  name: string
  slug: string
  website: string | null
}

interface BatchStatus {
  startedAt: string
  startedBy: string
  finished: boolean
  counts: Record<BatchState, number>
  items: ({ articleId: string; title: string; research: boolean } & BatchRow)[]
}

// DR-003 option A: status cards + ordered content queue + activity rail. DR-012: template chips and
// filter, "N need review", and "Generate queued" with live progress. DR-017: research on/off per topic
// (chip + bulk bar); the batch researches the topics that have it on, then drafts, three at a time.
export function HomeView({
  client,
  initialArticles,
  events,
  people,
}: {
  client: HomeClient
  initialArticles: ArticleSummary[]
  events: ArticleEventDTO[]
  people: Person[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [articles, setArticles] = useState(initialArticles)
  const [status, setStatus] = useState<ArticleStatus | null>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<ArticleSummary | null>(null)
  const [templateFilter, setTemplateFilter] = useState<string>('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [confirmBatch, setConfirmBatch] = useState(false)
  const [batch, setBatch] = useState<BatchStatus | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchIds, setBatchIds] = useState<string[] | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const templates = useClientTemplates(client.id)
  const templateNames = useMemo(() => new Map((templates ?? []).map((t) => [t.id, t.name])), [templates])

  useEffect(() => setArticles(initialArticles), [initialArticles])

  // ── "Generate queued" (DR-012) ──────────────────────────────────────────────────────────────
  const canGenerate = (a: ArticleSummary) => a.status === 'queued' && a.generationStatus !== 'running' && a.researchStatus !== 'running'
  const generatable = useMemo(() => articles.filter(canGenerate), [articles])
  /** Queued topics that will be researched first: research on and no brief yet (DR-017). */
  const willResearch = (list: ArticleSummary[]) => list.filter((a) => a.researchEnabled !== false && a.researchStatus !== 'ready').length
  const queuedCount = useMemo(() => articles.filter((a) => a.status === 'queued').length, [articles])
  const researchCount = useMemo(() => willResearch(articles.filter((a) => a.status === 'queued')), [articles])
  const selectedRows = useMemo(() => articles.filter((a) => selected.has(a.id)), [articles, selected])
  const batchTargets = useMemo(() => (batchIds ? articles.filter((a) => batchIds.includes(a.id)) : []), [articles, batchIds])
  const needsReview = useMemo(() => articles.filter((a) => a.needsReview).length, [articles])
  const batchRunning = !!batch && !batch.finished
  const batchMap = useMemo(
    () => (batch && !batch.finished ? new Map(batch.items.map((i) => [i.articleId, { state: i.state, step: i.step, message: i.message }])) : undefined),
    [batch],
  )

  // The last batch status seen, so the "finished" toast fires once, outside any state update. Toast and
  // router live in refs: useToast() returns a new object each render, which would re-create pollBatch and
  // re-run the mount effect below on every render (a polling loop).
  const lastBatch = useRef<BatchStatus | null>(null)
  const toastRef = useRef(toast)
  toastRef.current = toast
  const routerRef = useRef(router)
  routerRef.current = router
  const pollBatch = useCallback(async () => {
    const toast = toastRef.current
    const router = routerRef.current
    try {
      const d = await apiFetch<{ batch: BatchStatus | null }>(`/api/clients/${client.id}/articles/generate-batch`, { silent: true })
      const prev = lastBatch.current
      lastBatch.current = d.batch
      setBatch(d.batch)
      if (prev && !prev.finished && d.batch?.finished) {
        const c = d.batch.counts
        const done = c.done + c['needs-review']
        if (c.failed) toast.error(`Batch finished: ${c.failed} failed`, `${done} of ${d.batch.items.length} generated${c['needs-review'] ? `, ${c['needs-review']} need review` : ''}. Open a failed topic to see why.`)
        else if (c['needs-review']) toast.warning('Batch finished', `${done} generated, ${c['needs-review']} need review.`)
        else toast.success('Batch complete', `${done} of ${d.batch.items.length} generated.`)
        router.refresh()
      }
    } catch {
      // silent: the strip just stops updating
    }
  }, [client.id])

  useEffect(() => {
    void pollBatch()
  }, [pollBatch])
  useEffect(() => {
    if (!batchRunning) return
    const t = setInterval(() => void pollBatch(), 2000)
    return () => clearInterval(t)
  }, [batchRunning, pollBatch])

  async function startBatch() {
    const ids = batchIds ?? []
    setConfirmBatch(false)
    setBatchIds(null)
    try {
      await apiFetch(`/api/clients/${client.id}/articles/generate-batch`, {
        method: 'POST',
        body: { articleIds: ids },
        errorTitle: 'Couldn’t start generating',
      })
      setSelected(new Set())
      await pollBatch()
    } catch {
      // toasted
    }
  }

  function askBatch(list: ArticleSummary[]) {
    const ids = list.filter(canGenerate).map((a) => a.id)
    if (!ids.length) return
    setBatchIds(ids)
    setConfirmBatch(true)
  }

  /** DR-017: switch research on/off for one or many topics; optimistic, rolled back on failure. */
  async function setResearch(ids: string[], on: boolean) {
    const targets = articles.filter((a) => ids.includes(a.id) && a.status === 'queued' && a.researchStatus !== 'ready')
    if (!targets.length) return
    const previous = articles
    const targetIds = new Set(targets.map((a) => a.id))
    setArticles((list) => list.map((a) => (targetIds.has(a.id) ? { ...a, researchEnabled: on } : a)))
    setBulkBusy(true)
    try {
      const { skipped } = await apiFetch<{ updated: string[]; skipped: string[] }>(`/api/clients/${client.id}/articles/research-setting`, {
        method: 'PATCH',
        body: { articleIds: [...targetIds], on },
        errorTitle: 'Couldn’t change research',
      })
      if (skipped.length) {
        const back = new Set(skipped)
        setArticles((list) => list.map((a) => (back.has(a.id) ? (previous.find((p) => p.id === a.id) ?? a) : a)))
        toast.warning(`${skipped.length} not changed`, 'They’re being researched or written right now.')
      } else if (targets.length > 1) {
        toast.success(`Research ${on ? 'on' : 'off'} for ${targets.length} topics`)
      }
    } catch {
      setArticles(previous)
    } finally {
      setBulkBusy(false)
    }
  }

  function selectRows(ids: string[], checked: boolean) {
    setSelected((cur) => {
      const next = new Set(cur)
      for (const id of ids) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  const peopleMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])
  const counts = useMemo(() => {
    const c = Object.fromEntries(ARTICLE_STATUSES.map((s) => [s, 0])) as StatusCounts
    for (const a of articles) c[a.status]++
    return c
  }, [articles])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles.filter(
      (a) =>
        (!status || a.status === status) &&
        (!templateFilter || (templateFilter === 'none' ? !a.templateId : a.templateId === templateFilter)) &&
        (!reviewOnly || a.needsReview) &&
        (!q || a.title.toLowerCase().includes(q) || a.keywords.some((k) => k.toLowerCase().includes(q))),
    )
  }, [articles, status, query, templateFilter, reviewOnly])
  const filtered = !!status || !!query.trim() || !!templateFilter || reviewOnly

  async function reorder(activeId: string, overId: string) {
    const from = articles.findIndex((a) => a.id === activeId)
    const to = articles.findIndex((a) => a.id === overId)
    if (from < 0 || to < 0) return
    const previous = articles
    const next = arrayMove(articles, from, to)
    setArticles(next)
    const i = next.findIndex((a) => a.id === activeId)
    try {
      await apiFetch(`/api/clients/${client.id}/articles/reorder`, {
        method: 'POST',
        errorTitle: 'Couldn’t reorder the queue',
        body: { articleId: activeId, beforeId: next[i - 1]?.id ?? null, afterId: next[i + 1]?.id ?? null },
      })
    } catch {
      setArticles(previous)
    }
  }

  async function confirmDelete() {
    const target = deleting
    setDeleting(null)
    if (!target) return
    const previous = articles
    setArticles((list) => list.filter((a) => a.id !== target.id))
    try {
      await apiFetch(`/api/clients/${client.id}/articles/${target.id}`, { method: 'DELETE', errorTitle: 'Delete failed' })
      router.refresh()
    } catch {
      setArticles(previous)
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="p-8 xl:p-10 max-w-[1440px] mx-auto">
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-display text-heading truncate">{client.name}</h1>
          {client.website && (
            <a href={client.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent transition-colors mt-1">
              {client.website.replace(/^https?:\/\//, '')}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(generatable.length > 0 || batchRunning) && (
            <button
              type="button"
              onClick={() => askBatch(generatable)}
              disabled={batchRunning}
              className="px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 border border-accent/40 text-accent hover:bg-accent/10 transition-colors disabled:opacity-60"
              title="Research (where it’s on) and draft every queued article, three at a time"
            >
              {batchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {batchRunning ? 'Generating…' : `Generate queued (${generatable.length})`}
            </button>
          )}
          <Link
            href={`/c/${client.slug}/import`}
            className="px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 border border-border text-body hover:text-heading hover:bg-surface-hover transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import sheet
          </Link>
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm font-medium flex items-center gap-2 transition-all hover:shadow-glow-accent-strong"
          >
            <Plus className="w-4 h-4" />
            New Article
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="mb-8">
        <StatusCards counts={counts} active={status} onSelect={setStatus} />
      </motion.div>

      <div className="grid grid-cols-1 min-[1700px]:grid-cols-[minmax(0,1fr)_300px] gap-8 items-start">
        <motion.section variants={itemVariants} className="min-w-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-xl font-display text-heading">
                Content queue
                {status && <span className="text-muted text-base font-sans"> · {ARTICLE_STATUS_LABELS[status]}</span>}
              </h2>
              {needsReview > 0 && (
                <button
                  type="button"
                  onClick={() => setReviewOnly((v) => !v)}
                  aria-pressed={reviewOnly}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
                    reviewOnly ? 'border-warning bg-warning/20 text-orange-400' : 'border-warning/40 bg-warning/10 text-orange-400 hover:bg-warning/20'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  <span className="font-mono tabular-nums">{needsReview}</span> {needsReview === 1 ? 'needs' : 'need'} review
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {templates && templates.length > 0 && (
                <select
                  value={templateFilter}
                  onChange={(e) => setTemplateFilter(e.target.value)}
                  aria-label="Filter by template"
                  className="px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                >
                  <option value="">All templates</option>
                  <option value="none">No template</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-xs text-muted font-mono tabular-nums whitespace-nowrap">
                {visible.length} of {articles.length}
              </span>
              <div className="relative">
                <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles and keywords"
                  className="w-64 pl-9 pr-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-input-border)] rounded-input text-sm text-heading placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {queuedCount > 0 && !batchRunning && (
            <p className="text-xs text-muted -mt-2 mb-3" aria-live="polite">
              <span className="font-mono tabular-nums">{queuedCount}</span> queued ·{' '}
              <span className="font-mono tabular-nums">{researchCount}</span> will be researched first. Click a topic’s Research chip to change it, or select
              several.
            </p>
          )}

          {articles.length === 0 ? (
            <div className="glass-card p-10 text-center space-y-3">
              <FileText className="w-8 h-8 text-accent mx-auto" />
              <h3 className="text-heading font-medium">No articles yet</h3>
              <p className="text-muted text-sm">Import the client’s approved content calendar, or add articles one at a time.</p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Link href={`/c/${client.slug}/import`} className="px-4 py-2 rounded-input text-sm border border-border text-body hover:bg-surface-hover">
                  Import sheet
                </Link>
                <button type="button" onClick={() => setAdding(true)} className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-input text-sm">
                  New Article
                </button>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-muted">No articles match these filters.</div>
          ) : (
            <div className="glass-card p-0 overflow-hidden">
              {batch && batchRunning && (
                <div className="px-4 py-3 border-b border-border bg-accent/5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-heading flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      Generating {batch.counts.running + batch.counts.done + batch.counts['needs-review'] + batch.counts.failed} of {batch.items.length}
                    </span>
                    <span className="text-xs text-muted font-mono tabular-nums">
                      {batch.counts.done} done · {batch.counts['needs-review']} need review · {batch.counts.failed} failed
                    </span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{
                        width: `${((batch.counts.done + batch.counts['needs-review'] + batch.counts.failed) / Math.max(batch.items.length, 1)) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1.5">Three at a time; topics with research on are researched first. You can leave this page; drafts are saved as they finish.</p>
                </div>
              )}
              <QueueTable
                articles={visible}
                people={peopleMap}
                draggable={!filtered}
                templateNames={templateNames}
                batch={batchMap}
                selected={selected}
                onSelect={selectRows}
                onResearch={(a, on) => void setResearch([a.id], on)}
                onOpen={(a) => router.push(`/c/${client.slug}/articles/${a.id}`)}
                onDelete={setDeleting}
                onReorder={reorder}
              />
            </div>
          )}
          {filtered && articles.length > 0 && (
            <p className="text-xs text-muted mt-3">Clear the filter and search to reorder the queue.</p>
          )}
        </motion.section>

        <motion.div variants={itemVariants} className="hidden xl:block">
          <ActivityRail events={events} clientSlug={client.slug} />
        </motion.div>
      </div>

      <BulkBar
        count={selectedRows.length}
        generatable={selectedRows.filter(canGenerate).length}
        busy={bulkBusy || batchRunning}
        onResearch={(on) => void setResearch([...selected], on)}
        onGenerate={() => askBatch(selectedRows)}
        onClear={() => setSelected(new Set())}
      />

      <NewArticleModal
        isOpen={adding}
        clientId={client.id}
        onClose={() => setAdding(false)}
        onCreated={(a) => {
          setAdding(false)
          setArticles((list) => [...list, a])
          setStatus(null)
          toast.success('Article added to the queue', a.title)
          router.refresh()
        }}
      />

      <ConfirmModal
        isOpen={confirmBatch}
        title={`Generate ${batchTargets.length} ${batchTargets.length === 1 ? 'article' : 'articles'}?`}
        message={`${
          willResearch(batchTargets)
            ? `${willResearch(batchTargets)} of them ${willResearch(batchTargets) === 1 ? 'is' : 'are'} researched first (live web search). `
            : 'None are researched first. '
        }Each then gets a draft, from its template when it has one, three at a time. This uses the configured AI models for every article. You can leave this page while it runs.`}
        confirmLabel={`Generate ${batchTargets.length}`}
        confirmVariant="warning"
        onConfirm={startBatch}
        onCancel={() => {
          setConfirmBatch(false)
          setBatchIds(null)
        }}
      />

      <ConfirmModal
        isOpen={!!deleting}
        title="Delete article"
        message={`“${deleting?.title ?? ''}” will be permanently deleted, including its research, draft and version history. This can’t be undone.`}
        confirmLabel="Delete article"
        confirmVariant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </motion.div>
  )
}
