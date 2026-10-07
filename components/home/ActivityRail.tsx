'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { ARTICLE_STATUS_LABELS, type ArticleEventDTO, type ArticleStatus } from '@/lib/articles/schemas'
import { apiFetch } from '@/lib/api/fetch'

const PAGE_SIZE = 12

function describe(e: ArticleEventDTO): string {
  switch (e.type) {
    case 'imported':
      return 'imported'
    case 'created':
      return 'added'
    case 'researched':
      return 'researched'
    case 'generated':
      return 'generated a draft of'
    case 'revised':
      return 'revised the draft of'
    case 'status_changed':
      return 'moved'
    default:
      return e.type.replace(/_/g, ' ')
  }
}

function EventAvatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={image} alt="" title={name ?? undefined} referrerPolicy="no-referrer" className="w-6 h-6 rounded-full border border-border shrink-0" />
    )
  }
  return (
    <div
      title={name ?? undefined}
      className="w-6 h-6 rounded-full bg-surface-hover border border-border flex items-center justify-center text-[10px] font-bold text-heading shrink-0"
    >
      {name
        ? name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]!.toUpperCase())
            .join('')
        : '·'}
    </div>
  )
}

// DR-003: recent activity for this client. DR-019 (approved): avatars + "Load more" pagination.
export function ActivityRail({
  events,
  clientId,
  clientSlug,
  initialCursor,
}: {
  events: ArticleEventDTO[]
  clientId: string
  clientSlug: string
  initialCursor: string | null
}) {
  const [items, setItems] = useState(events)
  const [cursor, setCursor] = useState(initialCursor)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setItems(events)
    setCursor(initialCursor)
  }, [events, initialCursor])

  async function loadMore() {
    if (!cursor || loading) return
    setLoading(true)
    try {
      const page = await apiFetch<{ events: ArticleEventDTO[]; nextCursor: string | null }>(
        `/api/clients/${clientId}/activity?limit=${PAGE_SIZE}&before=${encodeURIComponent(cursor)}`,
        { errorTitle: 'Couldn’t load more activity' },
      )
      setItems((list) => [...list, ...page.events])
      setCursor(page.nextCursor)
    } catch {
      // apiFetch already toasted
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="glass-card p-5">
      <h2 className="text-sm font-medium text-heading mb-4">Recent activity</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ol className="space-y-4">
          {items.map((e) => (
            <li key={e.id} className="flex items-start gap-3 text-sm leading-snug">
              <EventAvatar name={e.userName} image={e.userImage} />
              <div className="min-w-0">
                <span className="text-heading font-medium">{e.userName ?? 'Someone'}</span>{' '}
                <span className="text-muted">{describe(e)}</span>{' '}
                <Link href={`/c/${clientSlug}/articles/${e.articleId}`} className="text-body hover:text-accent transition-colors">
                  {e.articleTitle}
                </Link>
                {e.type === 'status_changed' && e.toStatus && (
                  <span className="text-muted"> to {ARTICLE_STATUS_LABELS[e.toStatus as ArticleStatus] ?? e.toStatus}</span>
                )}
                <div className="text-xs text-muted font-mono mt-0.5">
                  {formatDistanceToNowStrict(new Date(e.at), { addSuffix: true })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2 border border-border text-body hover:text-heading hover:bg-surface-hover rounded-input px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Load more
        </button>
      )}
      {!cursor && items.length > 0 && <p className="mt-4 text-center text-xs text-muted">You’re all caught up.</p>}
    </aside>
  )
}
