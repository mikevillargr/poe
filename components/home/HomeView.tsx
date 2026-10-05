'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Plus, Upload, Search, ExternalLink, FileText } from 'lucide-react'
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
import { QueueTable, type Person } from './QueueTable'
import { ActivityRail } from './ActivityRail'
import { NewArticleModal } from './NewArticleModal'

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

// DR-003 option A: status cards + ordered content queue + activity rail.
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

  useEffect(() => setArticles(initialArticles), [initialArticles])

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
        (!q || a.title.toLowerCase().includes(q) || a.keywords.some((k) => k.toLowerCase().includes(q))),
    )
  }, [articles, status, query])
  const filtered = !!status || !!query.trim()

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

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-8 items-start">
        <motion.section variants={itemVariants} className="min-w-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-xl font-display text-heading">
              Content queue
              {status && <span className="text-muted text-base font-sans"> · {ARTICLE_STATUS_LABELS[status]}</span>}
            </h2>
            <div className="flex items-center gap-3">
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
              <QueueTable
                articles={visible}
                people={peopleMap}
                draggable={!filtered}
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
