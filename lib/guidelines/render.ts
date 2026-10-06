// Pure guideline types and prompt rendering (no DB), shared by every prompt that includes guidelines.

export interface PromptGuideline {
  category: string
  title: string | null
  rule: string
  weight: number
}

/** D-003: agency-wide (Universal) rules come first; the client's own rules win where they conflict. */
export type GuidelineTier = 'universal' | 'client'

export interface GuidelineGroup {
  category: string
  tier: GuidelineTier
  rules: PromptGuideline[]
}

export const TIER_HEADINGS: Record<GuidelineTier, string> = {
  universal: 'AGENCY-WIDE RULES (every client follows these first)',
  client: 'CLIENT RULES (where one contradicts an agency-wide rule, the client rule wins)',
}

/**
 * Renders groups under the two tier headings, agency-wide first, with `renderGroup` for each category
 * group. Used by every prompt that includes guidelines, so the order and precedence read the same everywhere.
 */
export function renderGuidelineTiers(groups: GuidelineGroup[], renderGroup: (g: GuidelineGroup) => string): string {
  return (['universal', 'client'] as const)
    .map((tier) => {
      const mine = groups.filter((g) => (g.tier ?? 'client') === tier)
      return mine.length ? `${TIER_HEADINGS[tier]}\n\n${mine.map(renderGroup).join('\n\n')}` : ''
    })
    .filter(Boolean)
    .join('\n\n')
}
