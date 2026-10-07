// DR-020: how coalesced provenance entries merge (pure, unit-tested).

/** Field edits keep the first "from" and the latest "to" per field across a burst. */
export function mergeFieldChanges(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  type Change = { field: string; from: unknown; to: unknown }
  const byField = new Map<string, Change>()
  for (const c of (prev.changes as Change[] | undefined) ?? []) byField.set(c.field, c)
  for (const c of (next.changes as Change[] | undefined) ?? []) {
    const old = byField.get(c.field)
    byField.set(c.field, { field: c.field, from: old ? old.from : c.from, to: c.to })
  }
  // Fields edited back to their starting value drop out.
  return { changes: [...byField.values()].filter((c) => JSON.stringify(c.from) !== JSON.stringify(c.to)) }
}

/** Draft edits: keep the session's starting word count and checkpoint; update the rest. */
export function mergeDraftEdits(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  return {
    ...next,
    wordsBefore: prev.wordsBefore ?? next.wordsBefore,
    checkpointVersionNo: prev.checkpointVersionNo ?? next.checkpointVersionNo,
    saves: Number(prev.saves ?? 0) + 1,
  }
}

export const FIELD_EDIT_WINDOW_MS = 10 * 60_000
export const DRAFT_EDIT_WINDOW_MS = 15 * 60_000
