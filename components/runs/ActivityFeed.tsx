'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Globe, Search, CircleDot } from 'lucide-react'
import type { FeedItem } from '@/lib/ai/client/activity'

// DR-016: what the run has done so far, newest last: searches, sources read, template steps.
function domain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function ActivityFeed({ items, max = 6 }: { items: FeedItem[]; max?: number }) {
  const shown = items.slice(-max)
  const hidden = items.length - shown.length
  if (!items.length) return null
  return (
    <div className="space-y-1.5">
      {hidden > 0 && <p className="text-[11px] text-muted">+{hidden} earlier</p>}
      <AnimatePresence initial={false}>
        {shown.map((it) => (
          <motion.div
            key={it.id}
            layout
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2 text-xs text-body min-w-0"
          >
            {it.kind === 'search' ? (
              <>
                <Search className="w-3.5 h-3.5 text-muted shrink-0 mt-px" />
                <span className="truncate">
                  Searched <span className="text-heading">“{it.text}”</span>
                </span>
              </>
            ) : it.kind === 'sources' ? (
              <>
                <Globe className="w-3.5 h-3.5 text-muted shrink-0 mt-px" />
                <span className="min-w-0">
                  Read{' '}
                  {(it.urls ?? []).slice(0, 3).map((u, i) => (
                    <span key={u}>
                      {i > 0 && ', '}
                      <a href={u} target="_blank" rel="noreferrer" className="text-heading hover:text-accent">
                        {domain(u)}
                      </a>
                    </span>
                  ))}
                  {(it.urls?.length ?? 0) > 3 && <span className="text-muted"> +{(it.urls?.length ?? 0) - 3} more</span>}
                </span>
              </>
            ) : (
              <>
                <CircleDot className="w-3.5 h-3.5 text-accent shrink-0 mt-px" />
                <span className="truncate">{it.text}</span>
              </>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
