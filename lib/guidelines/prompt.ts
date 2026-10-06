import 'server-only'
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { clientUniversalOverrides, heuristics, universalGuidelines } from '@/lib/db/schema'
import { categoryRank } from './categories'
import type { GuidelineGroup, GuidelineTier, PromptGuideline } from './render'

export type { GuidelineGroup, GuidelineTier, PromptGuideline } from './render'

/**
 * Groups guidelines by (lowercased, trimmed) category, in canonical category order with unknown
 * categories just before the blacklist; heaviest rules first within a group (stable, so the
 * caller's sortOrder tiebreak is preserved).
 */
export function groupForPrompt(rows: PromptGuideline[], tier: GuidelineTier = 'client'): GuidelineGroup[] {
  const groups = new Map<string, PromptGuideline[]>()
  for (const r of rows) {
    const key = r.category.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b))
    .map(([category, rules]) => ({ category, tier, rules: rules.sort((a, b) => b.weight - a.weight) }))
}

/**
 * What a client's articles follow (D-003): the live Universal rules that are on (minus any this client switched
 * off), then the client's own active rules, each grouped by category, heaviest first. Client rules scoped to a
 * content template (D-002) are included only for articles made with that template.
 */
export async function getGuidelinesForPrompt(tenantId: string, contentTemplateId?: string | null): Promise<GuidelineGroup[]> {
  const scope = contentTemplateId
    ? or(isNull(heuristics.contentTemplateId), eq(heuristics.contentTemplateId, contentTemplateId))
    : isNull(heuristics.contentTemplateId)
  const [universal, own] = await Promise.all([
    db
      .select({ category: universalGuidelines.category, title: universalGuidelines.title, rule: universalGuidelines.rule, weight: universalGuidelines.weight })
      .from(universalGuidelines)
      .leftJoin(
        clientUniversalOverrides,
        and(eq(clientUniversalOverrides.universalGuidelineId, universalGuidelines.id), eq(clientUniversalOverrides.tenantId, tenantId)),
      )
      .where(and(eq(universalGuidelines.active, true), or(isNull(clientUniversalOverrides.active), eq(clientUniversalOverrides.active, true))))
      .orderBy(asc(universalGuidelines.category), desc(universalGuidelines.weight), asc(universalGuidelines.sortOrder)),
    db
      .select({ category: heuristics.category, title: heuristics.title, rule: heuristics.rule, weight: heuristics.weight })
      .from(heuristics)
      .where(and(eq(heuristics.tenantId, tenantId), eq(heuristics.active, true), scope))
      .orderBy(asc(heuristics.category), desc(heuristics.weight), asc(heuristics.sortOrder)),
  ])
  return [...groupForPrompt(universal, 'universal'), ...groupForPrompt(own, 'client')]
}
