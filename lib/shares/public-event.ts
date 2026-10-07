// DR-021: what of a provenance event a shared page may show (pure).

import type { HistoryEvent } from '@/lib/articles/history-format'

// Payload keys that may hold internal notes or draft text; the public timeline shows sentences and numbers only.
const PRIVATE_KEYS = ['feedback', 'instruction', 'original', 'suggested', 'replacement', 'inputs', 'url', 'reason', 'note', 'excerpt']
export const HIDDEN_TYPES = new Set(['shared'])

export function publicEvent(e: HistoryEvent): HistoryEvent {
  if (!e.payload) return e
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(e.payload)) {
    if (PRIVATE_KEYS.includes(k)) continue
    // Field edits keep which fields changed, not their old and new values.
    payload[k] = k === 'changes' && Array.isArray(v) ? v.map((c: { field?: string }) => ({ field: c.field })) : v
  }
  return { ...e, payload }
}
