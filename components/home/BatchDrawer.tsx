'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ExternalLink, X } from 'lucide-react'
import { useAIStream } from '@/lib/ai/client/useAIStream'
import { countWords } from '@/lib/articles/text'
import { cleanGeneratedHtml } from '@/lib/pipeline/html'
import { RunActivity } from '@/components/runs/RunActivity'
import { useRunEstimates } from '@/components/runs/useRunEstimates'
import { StreamingPreview } from '@/components/workspace/StreamingPreview'
import type { BatchState } from './QueueTable'

// DR-016: watch one article of a running "Generate queued" batch: its live research or writing, the thinking
// peek, and the draft as it streams. Follows the item from research to writing.

export interface WatchedItem {
  articleId: string
  title: string
  templated: boolean
  targetWords: number | null
  step?: 'researching' | 'writing'
  stepStartedAt?: string
  state: BatchState
  message?: string
}

export function BatchDrawer({
  clientId,
  clientSlug,
  item,
  onClose,
}: {
  clientId: string
  clientSlug: string
  item: WatchedItem | null
  onClose: () => void
}) {
  const stream = useAIStream()
  const estimates = useRunEstimates()
  const kind = item?.step === 'researching' ? 'research' : 'generation'
  const attachKey = item && item.state === 'running' ? `${item.articleId}:${kind}` : null

  // Attach to the run the item is in now; re-attach when it moves from research to writing.
  useEffect(() => {
    if (!attachKey || !item) return
    void stream.attach(`/api/clients/${clientId}/articles/${item.articleId}/runs/${kind}`)
    return () => stream.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachKey])

  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  const words = kind === 'generation' ? countWords(cleanGeneratedHtml(stream.text)) : undefined
  const finished = item && item.state !== 'running' && item.state !== 'queued'

  return (
    <AnimatePresence>
      {item && (
        <motion.aside
          role="dialog"
          aria-label={`Live activity: ${item.title}`}
          initial={{ x: 40, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          className="fixed top-4 right-4 bottom-4 z-50 w-[440px] max-w-[calc(100vw-2rem)] glass-card shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-border flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted">
                {item.state === 'queued' ? 'Waiting' : item.state === 'running' ? (kind === 'research' ? 'Researching' : 'Writing') : 'Finished'}
              </p>
              <h2 className="text-base font-display text-heading line-clamp-2">{item.title}</h2>
            </div>
            <Link
              href={`/c/${clientSlug}/articles/${item.articleId}`}
              className="p-1.5 rounded text-muted hover:text-accent hover:bg-surface-hover"
              title="Open article"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded text-muted hover:text-heading hover:bg-surface-hover">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
            {item.state === 'queued' ? (
              <p className="text-sm text-muted">Waiting for a free slot. Three topics run at a time; this one starts when another finishes.</p>
            ) : finished ? (
              <p className={`text-sm ${item.state === 'failed' ? 'text-red-400' : 'text-body'}`}>
                {item.state === 'failed' ? `Didn’t finish: ${item.message ?? 'unknown error'}` : item.state === 'cancelled' ? 'Stopped before it started. It’s still queued.' : item.state === 'needs-review' ? 'Drafted. Some checks still fail; open it to review.' : 'Drafted and saved.'}
              </p>
            ) : (
              <RunActivity
                kind={kind === 'research' ? 'research' : item.templated ? 'template' : 'generation'}
                activity={stream.activity}
                startedAt={item.stepStartedAt ?? null}
                model={null}
                estimateMs={kind === 'research' ? estimates.research : estimates.generation}
                writtenWords={words}
                targetWords={item.targetWords}
                remote={stream.status === 'idle'}
              />
            )}
            {kind === 'generation' && stream.text && (
              <div className="rounded-input border border-border bg-[var(--color-editor-bg)] max-h-[360px] overflow-y-auto custom-scrollbar [&_.prose]:px-3 [&_.prose]:py-2 [&_.prose]:text-sm">
                <StreamingPreview html={stream.text} />
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
