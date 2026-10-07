import 'server-only'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiUsage } from '@/lib/db/schema'
import { resolveRole } from './roles'
import type { ModelRole } from './types'

/** Median of a list (null when empty). */
export function median(values: number[]): number | null {
  if (!values.length) return null
  const v = [...values].sort((a, b) => a - b)
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? v[mid] : Math.round((v[mid - 1] + v[mid]) / 2)
}

/**
 * DR-016: "usually ~N min" for a role, from the last 20 calls of the model configured for it right now.
 * Null with fewer than 3 samples (or no configured model), so the UI shows no estimate rather than a guess.
 */
export async function typicalDurationMs(role: ModelRole): Promise<number | null> {
  let model: string
  try {
    model = (await resolveRole(role)).modelId
  } catch {
    return null
  }
  const rows = await db
    .select({ ms: aiUsage.durationMs })
    .from(aiUsage)
    .where(and(eq(aiUsage.role, role), eq(aiUsage.model, model), isNotNull(aiUsage.durationMs)))
    .orderBy(desc(aiUsage.at))
    .limit(20)
  const values = rows.map((r) => r.ms!).filter((n) => n > 0)
  return values.length >= 3 ? median(values) : null
}
