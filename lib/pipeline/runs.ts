import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles } from '@/lib/db/schema'
import { ApiError, Errors } from '@/lib/api/errors'
import { AIError, type AIStreamEvent } from '@/lib/ai/types'
import { getArticle } from '@/lib/articles/repo'
import { isRunStale, statusAfterStop, type RunKind, type RunStatus } from './run-state'

// Research and generation run detached from the HTTP request: the model call and the persistence
// live in a Run held in this process's memory, and the SSE response is only a live view of it
// (replay of what's happened so far, then new events). A client disconnect never cancels a run;
// only stopRun() does. The registry is per process: a restart or deploy loses in-flight runs, and
// reconcileStaleRuns() then turns their `running` rows into `error` so the user can retry.

type Registry = Map<string, Run>
const g = globalThis as unknown as { __poeRuns?: Registry }
const registry: Registry = (g.__poeRuns ??= new Map())
const keyOf = (kind: RunKind, articleId: string) => `${kind}:${articleId}`

export class Run {
  readonly events: AIStreamEvent[] = []
  readonly ac = new AbortController()
  finished = false
  private wakers = new Set<() => void>()
  private completion: Promise<void> = Promise.resolve()

  constructor(readonly kind: RunKind, readonly articleId: string) {}

  emit(ev: AIStreamEvent) {
    this.events.push(ev)
    this.wake()
  }

  private wake() {
    for (const w of this.wakers) w()
  }

  /** Runs `body` in the background; it keeps going whether or not anyone is subscribed. */
  start(body: (run: Run) => Promise<void>) {
    this.completion = body(this)
      .catch((err) => console.error(`${this.kind} run failed:`, err))
      .finally(() => this.release())
  }

  release() {
    this.finished = true
    if (registry.get(keyOf(this.kind, this.articleId)) === this) registry.delete(keyOf(this.kind, this.articleId))
    this.wake()
  }

  /** Resolves when the run's body has finished (successfully or not). */
  whenDone(): Promise<void> {
    return this.completion
  }

  waitDone(timeoutMs: number) {
    return Promise.race([this.completion, new Promise<void>((r) => setTimeout(r, timeoutMs))])
  }

  /** Replays buffered events, then live ones. Detaching (abort / early return) never affects the run. */
  async *subscribe(signal?: AbortSignal): AsyncGenerator<AIStreamEvent> {
    let i = 0
    for (;;) {
      while (i < this.events.length) yield this.events[i++]
      if (this.finished || signal?.aborted) return
      await new Promise<void>((resolve) => {
        const wake = () => {
          this.wakers.delete(wake)
          signal?.removeEventListener('abort', wake)
          resolve()
        }
        this.wakers.add(wake)
        signal?.addEventListener('abort', wake)
      })
    }
  }
}

export function getRun(kind: RunKind, articleId: string): Run | undefined {
  return registry.get(keyOf(kind, articleId))
}

/** Claims the single run slot for this article+kind (synchronously, so two requests can't both win). */
export function reserveRun(kind: RunKind, articleId: string): Run {
  if (registry.has(keyOf(kind, articleId))) {
    throw Errors.conflict(kind === 'research' ? 'Research is already running for this article.' : 'A draft is already being generated or revised for this article.')
  }
  const run = new Run(kind, articleId)
  registry.set(keyOf(kind, articleId), run)
  return run
}

/** Consumes provider events into the run, persisting via `onDone`. Never throws. */
export function drive(
  run: Run,
  events: AsyncIterable<AIStreamEvent>,
  hooks: {
    onDone: (done: Extract<AIStreamEvent, { type: 'done' }>) => Promise<AIStreamEvent[] | void>
    onPersistError: () => Promise<void>
  },
) {
  run.start(async () => {
    try {
      for await (const ev of events) {
        run.emit(ev)
        if (ev.type === 'done') {
          try {
            for (const e of (await hooks.onDone(ev)) ?? []) run.emit(e)
          } catch (err) {
            await hooks.onPersistError().catch(() => {})
            run.emit(errorEvent(err))
          }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError') && !run.ac.signal.aborted) {
        console.error(`${run.kind} stream error:`, err)
        run.emit(errorEvent(err))
      }
    }
  })
}

function errorEvent(err: unknown): AIStreamEvent {
  const code = err instanceof AIError || err instanceof ApiError ? err.code : 'PROVIDER_ERROR'
  return { type: 'error', code, message: err instanceof Error ? err.message : 'AI request failed.' }
}

// ── persisted state ──────────────────────────────────────────────────────────────────────────

const cols = {
  research: { status: 'researchStatus', startedAt: 'researchStartedAt' },
  generation: { status: 'generationStatus', startedAt: 'generationStartedAt' },
} as const

/** Sets research/generation status (and the start time when it becomes `running`). */
export async function setRunState(kind: RunKind, tenantId: string, articleId: string, state: RunStatus, extra: Record<string, unknown> = {}) {
  const c = cols[kind]
  await db
    .update(articles)
    .set({
      [c.status]: state,
      ...(state === 'running' ? { [c.startedAt]: new Date() } : {}),
      ...extra,
      updatedAt: new Date(),
    })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
}

/**
 * Marks `running` rows whose run is gone (server restart, or running past STALE_RUN_MS) as `error`,
 * and returns the fresh row. Cheap no-op when nothing is running.
 */
export async function getArticleReconciled(tenantId: string, articleId: string) {
  let row = await getArticle(tenantId, articleId)
  let changed = false
  for (const kind of ['research', 'generation'] as const) {
    const c = cols[kind]
    const status = row[c.status]
    if (status === 'running' && isRunStale({ status, startedAt: row[c.startedAt], hasLiveRun: !!getRun(kind, articleId) })) {
      const run = getRun(kind, articleId)
      if (run && !run.finished) run.ac.abort()
      await setRunState(kind, tenantId, articleId, 'error')
      changed = true
    }
  }
  if (changed) row = await getArticle(tenantId, articleId)
  return row
}

/** Explicit Stop: aborts a live run (its own hooks reset the status); resets orphaned `running` rows. */
export async function stopRun(kind: RunKind, tenantId: string, articleId: string): Promise<{ stopped: boolean }> {
  const live = getRun(kind, articleId)
  if (live) {
    live.ac.abort()
    await live.waitDone(8000)
    return { stopped: true }
  }
  const row = await getArticle(tenantId, articleId)
  if (row[cols[kind].status] === 'running') {
    const hasResult = kind === 'research' ? !!row.research : !!row.draftHtml
    await setRunState(kind, tenantId, articleId, statusAfterStop(hasResult))
    return { stopped: true }
  }
  return { stopped: false }
}
