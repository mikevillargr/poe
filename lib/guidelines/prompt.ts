import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'
import { categoryRank } from './categories'

export interface PromptGuideline {
  category: string
  title: string | null
  rule: string
  weight: number
}

export interface GuidelineGroup {
  category: string
  rules: PromptGuideline[]
}

/**
 * Groups guidelines by (lowercased, trimmed) category, in canonical category order with unknown
 * categories just before the blacklist; heaviest rules first within a group (stable, so the
 * caller's sortOrder tiebreak is preserved).
 */
export function groupForPrompt(rows: PromptGuideline[]): GuidelineGroup[] {
  const groups = new Map<string, PromptGuideline[]>()
  for (const r of rows) {
    const key = r.category.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map(([category, rules]) => ({ category, rules: rules.sort((a, b) => b.weight - a.weight) }))
}

/** The client's active guidelines, grouped by category, heaviest first within a group. */
export async function getGuidelinesForPrompt(tenantId: string): Promise<GuidelineGroup[]> {
  const rows = await db
    .select({ category: heuristics.category, title: heuristics.title, rule: heuristics.rule, weight: heuristics.weight })
    .from(heuristics)
    .where(and(eq(heuristics.tenantId, tenantId), eq(heuristics.active, true)))
    .orderBy(asc(heuristics.category), desc(heuristics.weight), asc(heuristics.sortOrder))
  return groupForPrompt(rows)
}
