'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Clock, Loader2 } from 'lucide-react'
import { thoughtFor, type ActivityPhase, type ActivityState } from '@/lib/ai/client/activity'
import { formatElapsed, QUIET_AFTER_MS } from '@/lib/pipeline/run-state'
import { ThinkingPeek } from './ThinkingPeek'
import { ActivityFeed } from './ActivityFeed'

// DR-016: the live view of a running research, draft or template run: stepper, elapsed time against the usual
// duration, the thinking peek, a feed of what it did, and words written against the target.

export type RunActivityKind = 'research' | 'generation' | 'template'

const STEPS: Record<RunActivityKind, { label: string; phases: ActivityPhase[] }[]> = {
  research: [
    { label: 'Thinking', phases: ['starting', 'thinking'] },
    { label: 'Searching', phases: ['searching'] },
    { label: 'Reading sources', phases: ['reading'] },
    { label: 'Writing the brief', phases: ['writing', 'done'] },
  ],
  generation: [
    { label: 'Thinking', phases: ['starting', 'thinking'] },
    { label: 'Writing', phases: ['writing', 'done'] },
  ],
  template: [
    { label: 'Picking links', phases: ['starting', 'thinking', 'selecting', 'searching', 'reading'] },
    { label: 'Writing', phases: ['writing'] },
    { label: 'Checking', phases: ['checking', 'done'] },
  ],
}

const nf = new Intl.NumberFormat('en-US')

function minutes(ms: number) {
  const m = Math.round(ms / 60_000)
  return m <= 1 ? 'about a minute' : `~${m} min`
}

export function RunActivity({
  kind,
  activity,
  startedAt,
  model,
  estimateMs,
  writtenWords,
  targetWords,
  remote = false,
  showModel = true,
}: {
  kind: RunActivityKind
  activity: ActivityState
  /** Server start time, so the clock is right after returning to the page. */
  startedAt: string | null
  model: string | null
  /** Typical duration for this model, or null (no estimate shown). */
  estimateMs: number | null
  writtenWords?: number
  targetWords?: number | null
  /** Running without a live stream here (no detail available yet). */
  remote?: boolean
  /** False where the surrounding header already names the model. */
  showModel?: boolean
}) {
  const [now, setNow] = useState(() => Date.now())
  const mountedAt = useRef(Date.now())
  const lastSignal = useRef({ value: -1, at: Date.now() })
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const signal = activity.feed.length + activity.textChars + activity.thinking.length
  if (signal !== lastSignal.current.value) lastSignal.current = { value: signal, at: Date.now() }
  const start = startedAt ? new Date(startedAt).getTime() : mountedAt.current
  const elapsed = Number.isNaN(start) ? 0 : Math.max(0, now - start)
  const quiet = now - Math.max(lastSignal.current.at, mountedAt.current) > QUIET_AFTER_MS
  const name = model ? model.split(':').pop() : null

  const steps = STEPS[kind]
  // Template runs always pick links first only when the template has link steps; skip that step otherwise.
  const visibleSteps = kind === 'template' && !activity.feed.some((f) => f.kind === 'step' && /link/i.test(f.text)) && activity.phase !== 'selecting' && activity.phase !== 'starting'
    ? steps.slice(1)
    : steps
  const current = Math.max(0, visibleSteps.findIndex((s) => s.phases.includes(activity.phase)))
  const thinkingActive = activity.phase === 'thinking' || (activity.phase === 'starting' && !!activity.thinking)
  const pct = targetWords && writtenWords ? Math.min(100, Math.round((writtenWords / targetWords) * 100)) : null

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Clock className="w-3.5 h-3.5 text-muted" />
        <span className="font-mono tabular-nums text-heading">{formatElapsed(elapsed)}</span>
        {estimateMs !== null && <span className="text-muted">· usually {minutes(estimateMs)}</span>}
        {name && showModel && <span className="text-xs text-muted font-mono ml-auto">{name}</span>}
      </div>

      {!remote && (
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {visibleSteps.map((s, i) => {
            const state = i < current || activity.phase === 'done' ? 'done' : i === current ? 'active' : 'todo'
            return (
              <li key={s.label} className="flex items-center gap-1">
                {i > 0 && <span className={`w-4 h-px ${state === 'todo' ? 'bg-border' : 'bg-accent/50'}`} />}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${
                    state === 'done'
                      ? 'border-success/40 text-green-500 bg-success/10'
                      : state === 'active'
                        ? 'border-accent/40 text-accent bg-accent/10'
                        : 'border-border text-muted'
                  }`}
                >
                  {state === 'done' ? <Check className="w-3 h-3" /> : state === 'active' ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {s.label}
                  {s.label === 'Searching' && activity.searches > 0 && <span className="font-mono tabular-nums">· {activity.searches}</span>}
                  {s.label === 'Reading sources' && activity.sources > 0 && <span className="font-mono tabular-nums">· {activity.sources}</span>}
                </span>
              </li>
            )
          })}
        </ol>
      )}

      <ThinkingPeek thinking={activity.thinking} active={thinkingActive} thoughtMs={thoughtFor(activity)} />
      <ActivityFeed items={activity.feed} />

      {writtenWords !== undefined && writtenWords > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Writing</span>
            <span className="font-mono tabular-nums">
              {nf.format(writtenWords)}
              {targetWords ? ` / ${nf.format(targetWords)} words` : ' words'}
            </span>
          </div>
          {pct !== null && (
            <div className="mt-1 h-1 rounded-full bg-[var(--color-gauge-bg)] overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {remote && <p className="text-xs text-muted">Running in the background. Live detail appears when it reconnects.</p>}
      {quiet && !remote && (
        <p className="text-xs text-muted">
          Still working: {name ? <span className="font-mono">{name}</span> : 'the model'}{' '}
          {kind === 'research' ? 'can think for a few minutes before it searches.' : 'can take a few minutes before the first words appear.'}
        </p>
      )}
    </div>
  )
}
