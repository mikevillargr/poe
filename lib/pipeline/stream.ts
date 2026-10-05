import 'server-only'
import { db } from '@/lib/db'
import { articleEvents } from '@/lib/db/schema'
import { ApiError } from '@/lib/api/errors'
import { AIError, type AIStreamEvent, type Citation } from '@/lib/ai/types'

export interface StreamTap {
  queries: string[]
  citations: Citation[]
  /** True once the provider's `done` event has gone through. */
  done: boolean
  /** True if the provider yielded an `error` event or threw. */
  failed: boolean
}

/**
 * Passes provider events through unchanged while recording searches/citations, and reports how the
 * stream ended: `onFailed` for an error event or a throw, `onIncomplete` when the consumer stopped
 * early (client disconnect / abort) without `done` or an error.
 */
export function tapStream(
  source: AsyncIterable<AIStreamEvent>,
  hooks: { onFailed?: (err: unknown) => Promise<void>; onIncomplete?: () => Promise<void> } = {},
): { events: AsyncGenerator<AIStreamEvent>; tap: StreamTap } {
  const tap: StreamTap = { queries: [], citations: [], done: false, failed: false }
  async function* run(): AsyncGenerator<AIStreamEvent> {
    try {
      for await (const ev of source) {
        if (ev.type === 'search') tap.queries.push(ev.query)
        else if (ev.type === 'citation') tap.citations.push(ev.citation)
        else if (ev.type === 'done') tap.done = true
        else if (ev.type === 'error' && !tap.failed) {
          tap.failed = true
          await hooks.onFailed?.(new AIError('PROVIDER_ERROR', ev.message)).catch(logHookError)
        }
        yield ev
      }
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === 'AbortError'
      if (!aborted && !tap.failed) {
        tap.failed = true
        await hooks.onFailed?.(err).catch(logHookError)
      }
      throw err
    } finally {
      if (!tap.done && !tap.failed) await hooks.onIncomplete?.().catch(logHookError)
    }
  }
  return { events: run(), tap }
}

function logHookError(err: unknown) {
  console.error('pipeline stream hook failed:', err)
}

/** AI setup errors (no key, no role configured) thrown before streaming starts → `{ error, code }`. */
export function toApiError(err: unknown): unknown {
  if (err instanceof AIError) {
    const status = err.code === 'RATE_LIMITED' ? 429 : err.code === 'PROVIDER_ERROR' ? 502 : 503
    return new ApiError(status, err.code, err.message)
  }
  return err
}

export async function logArticleEvent(
  tenantId: string,
  articleId: string,
  type: string,
  userId: string | null,
  payload: Record<string, unknown> | null = null,
) {
  await db.insert(articleEvents).values({ tenantId, articleId, type, userId, payload })
}
