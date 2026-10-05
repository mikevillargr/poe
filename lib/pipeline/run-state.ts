// Pure run-state helpers (no server-only imports, so client code and tests can use them).

export type RunStatus = 'idle' | 'running' | 'ready' | 'error'
export type RunKind = 'research' | 'generation'

/** A run still marked `running` after this long is treated as dead (generous: Kimi may think for minutes). */
export const STALE_RUN_MS = 15 * 60 * 1000

/**
 * A `running` row is stale (the run is gone) when this process has no live run for it, which covers
 * server restarts and deploys, or when it has been running longer than STALE_RUN_MS.
 */
export function isRunStale(opts: {
  status: RunStatus
  startedAt: Date | string | null | undefined
  now?: number
  hasLiveRun: boolean
}): boolean {
  if (opts.status !== 'running') return false
  if (!opts.hasLiveRun) return true
  if (!opts.startedAt) return true
  const started = new Date(opts.startedAt).getTime()
  if (Number.isNaN(started)) return true
  return (opts.now ?? Date.now()) - started > STALE_RUN_MS
}

/** Status a stopped/aborted run goes back to: `ready` if it already has a result, else `idle`. */
export function statusAfterStop(hasResult: boolean): RunStatus {
  return hasResult ? 'ready' : 'idle'
}

export function formatElapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const QUIET_AFTER_MS = 20_000
