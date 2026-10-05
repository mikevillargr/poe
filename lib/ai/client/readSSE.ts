// Browser-side SSE reader for POST endpoints (EventSource can't POST). Shared by all streaming UIs.
import type { AIStreamEvent } from '../types'

export async function* readSSE(response: Response): AsyncGenerator<AIStreamEvent> {
  if (!response.ok || !response.body) {
    let body: { error?: string; code?: string } = {}
    try {
      body = await response.json()
    } catch {}
    yield { type: 'error', code: body.code ?? `HTTP_${response.status}`, message: body.error ?? response.statusText }
    return
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)
      const data = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n')
      if (data) yield JSON.parse(data) as AIStreamEvent
    }
  }
}
