import 'server-only'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { heuristics } from '@/lib/db/schema'

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

// Category order in prompts: hard constraints first, the AI-tell blacklist last so it's freshest.
const CATEGORY_ORDER = ['seo', 'structure', 'readability', 'sourcing', 'brand', 'agency', 'client', 'blacklist']

/**
 * The client's active guidelines, grouped by category, heaviest first within a group.
 * TODO(WS guidelines): swap for `getGuidelinesForPrompt(tenantId)` from lib/guidelines once it lands.
 */
export async function getActiveGuidelines(tenantId: string): Promise<GuidelineGroup[]> {
  const rows = await db
    .select({ category: heuristics.category, title: heuristics.title, rule: heuristics.rule, weight: heuristics.weight })
    .from(heuristics)
    .where(and(eq(heuristics.tenantId, tenantId), eq(heuristics.active, true)))
    .orderBy(asc(heuristics.category), desc(heuristics.weight), asc(heuristics.sortOrder))

  const groups = new Map<string, PromptGuideline[]>()
  for (const r of rows) {
    const key = r.category.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  const rank = (c: string) => {
    const i = CATEGORY_ORDER.indexOf(c)
    return i === -1 ? CATEGORY_ORDER.length - 1 - 0.5 : i // unknown categories go just before the blacklist
  }
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([category, rules]) => ({ category, rules }))
}
