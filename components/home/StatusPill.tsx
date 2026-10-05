import { ARTICLE_STATUS_LABELS, type ArticleStatus } from '@/lib/articles/schemas'
import { STATUS_STYLE } from './status'

export function StatusPill({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${STATUS_STYLE[status].pill}`}
    >
      {ARTICLE_STATUS_LABELS[status]}
    </span>
  )
}
