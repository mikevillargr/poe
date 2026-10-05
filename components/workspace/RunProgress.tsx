'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { formatElapsed, QUIET_AFTER_MS } from '@/lib/pipeline/run-state'

/**
 * Elapsed time + a plain-language status line for a long-running research/generation step, with a
 * reassurance line when nothing has arrived for a while (some models think silently for minutes).
 * `startedAt` is the server's start time, so the clock is right after returning to the page.
 * `activity` is any number that grows when something arrives (searches, sources, characters).
 */
export function RunProgress({
  kind,
  startedAt,
  activity,
  status,
  model,
}: {
  kind: 'research' | 'generation'
  startedAt: string | null
  /** Changes whenever new output arrives; used to detect a quiet spell. */
  activity: number
  /** What we know right now, e.g. "Searching the web · 3 searches". */
  status: string
  model: string | null
}) {
  const [now, setNow] = useState(() => Date.now())
  const mountedAt = useRef(Date.now())
  const lastActivityAt = useRef(Date.now())
  const lastActivity = useRef(activity)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (activity !== lastActivity.current) {
    lastActivity.current = activity
    lastActivityAt.current = Date.now()
  }

  const start = startedAt ? new Date(startedAt).getTime() : mountedAt.current
  const elapsed = Number.isNaN(start) ? 0 : now - start
  const quiet = now - Math.max(lastActivityAt.current, mountedAt.current) > QUIET_AFTER_MS
  const name = model ? model.split(':').pop() : null

  return (
    <div className="space-y-1.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-heading">
        <Clock className="w-3.5 h-3.5 text-muted" />
        <span className="font-mono tabular-nums">{formatElapsed(elapsed)}</span>
        <span className="text-muted">·</span>
        <span>{status}</span>
      </div>
      {quiet && (
        <p className="text-xs text-muted">
          Still working — {name ? <span className="font-mono">{name}</span> : 'some models'}{' '}
          {kind === 'research'
            ? name
              ? 'can think for a few minutes before it starts searching.'
              : 'think for a few minutes before they start searching.'
            : name
              ? 'can take a few minutes before the first words appear.'
              : 'take a few minutes before the first words appear.'}
        </p>
      )}
    </div>
  )
}
