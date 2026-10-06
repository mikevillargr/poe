import 'server-only'
import { AIError, type AIStreamEvent } from './types'
import { ApiError } from '@/lib/api/errors'

const HEARTBEAT_MS = 15_000

/**
 * Turns an AIStreamEvent iterable into a text/event-stream Response.
 * - `onDone` runs after the provider's `done` event (persist results there); any events it returns
 *   (e.g. `{ type: 'saved' }`) are sent before the stream closes.
 * - `onAbort` runs if the client disconnects first (persist partial text there if useful).
 * - Errors become a final `{ type: 'error' }` event instead of a broken stream.
 */
export function toSSEResponse(
  events: AsyncIterable<AIStreamEvent>,
  opts: {
    signal?: AbortSignal
    onDone?: (done: Extract<AIStreamEvent, { type: 'done' }>) => Promise<AIStreamEvent[] | void>
    onAbort?: (partialText: string) => Promise<void>
  } = {},
): Response {
  const encoder = new TextEncoder()
  let partial = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: AIStreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(': ping\n\n')), HEARTBEAT_MS)
      try {
        for await (const ev of events) {
          if (opts.signal?.aborted) break
          if (ev.type === 'delta') partial += ev.text
          else if (ev.type === 'reset') partial = ''
          send(ev)
          if (ev.type === 'done' && opts.onDone) {
            const extra = await opts.onDone(ev)
            for (const e of extra ?? []) send(e)
          }
        }
        if (opts.signal?.aborted) await opts.onAbort?.(partial)
      } catch (err) {
        if (opts.signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
          await opts.onAbort?.(partial).catch(() => {})
        } else {
          const code = err instanceof AIError || err instanceof ApiError ? err.code : 'PROVIDER_ERROR'
          const message = err instanceof Error ? err.message : 'AI request failed.'
          console.error('SSE stream error:', err)
          send({ type: 'error', code, message })
        }
      } finally {
        clearInterval(heartbeat)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
