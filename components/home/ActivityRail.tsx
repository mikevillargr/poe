'use client'

import Link from 'next/link'
import { formatDistanceToNowStrict } from 'date-fns'
import { ARTICLE_STATUS_LABELS, type ArticleEventDTO, type ArticleStatus } from '@/lib/articles/schemas'

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

// DR-003: recent activity for this client.
export function ActivityRail({ events, clientSlug }: { events: ArticleEventDTO[]; clientSlug: string }) {
  return (
    <aside className="glass-card p-5">
      <h2 className="text-sm font-medium text-heading mb-4">Recent activity</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ol className="space-y-4">
          {events.map((e) => (
            <li key={e.id} className="text-sm leading-snug">
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
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
