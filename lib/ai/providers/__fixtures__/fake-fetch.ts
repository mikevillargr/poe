import { readFileSync } from 'node:fs'

// Test-only fetch stub: serves canned JSON / SSE responses (shapes taken from provider docs; each
// fixture JSON has a `_source` note) and records every request, so adapters can be exercised end to
// end through the real SDK clients without API keys.

export type SSEEvent = { event?: string; data: unknown }

export type Canned =
  | { status?: number; json: unknown; headers?: Record<string, string> }
  | { status?: number; sse: SSEEvent[]; done?: boolean }

export interface RecordedRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: unknown
}

function sseBody(events: SSEEvent[], done: boolean): string {
  const parts = events.map((e) => `${e.event ? `event: ${e.event}\n` : ''}data: ${JSON.stringify(e.data)}\n\n`)
  if (done) parts.push('data: [DONE]\n\n')
  return parts.join('')
}

/**
 * `routes` maps a URL path suffix (e.g. '/v1/messages', '/tools/search') to a queue of responses,
 * served in order. An exhausted queue or unknown path is a test failure (status 599).
 */
export function fakeFetch(routes: Record<string, Canned[]>) {
  const requests: RecordedRequest[] = []
  const queues = Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, [...v]]))

  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const headers: Record<string, string> = {}
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v))
    let body: unknown = init?.body
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body)
      } catch {
        // keep raw
      }
    }
    requests.push({ url, method: init?.method ?? 'GET', headers, body })
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

    const path = new URL(url).pathname
    const key = Object.keys(queues).find((k) => path.endsWith(k))
    const next = key ? queues[key].shift() : undefined
    if (!next) return new Response(JSON.stringify({ error: `no canned response for ${path}` }), { status: 599 })
    if ('json' in next) {
      return new Response(JSON.stringify(next.json), {
        status: next.status ?? 200,
        headers: { 'content-type': 'application/json', ...next.headers },
      })
    }
    return new Response(sseBody(next.sse, next.done ?? false), {
      status: next.status ?? 200,
      headers: { 'content-type': 'text/event-stream' },
    })
  }) as typeof fetch

  return { fetch: fn, requests }
}

/** Loads a fixture JSON file from this directory (tests run from the repo root). */
export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(`lib/ai/providers/__fixtures__/${name}`, 'utf8')) as T
}
