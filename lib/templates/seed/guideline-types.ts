// Client-level guidelines imported from the n8n source-of-truth doc (D-002). Each client's rules are data
// in `./<client>/guidelines.ts` so they can be reviewed as a diff; the seed writes them as `ingested`
// heuristics. `template` scopes a rule to one of that client's templates (by slug); omitted = the rule
// applies to every article for the client.

import type { GuidelineCategory } from '@/lib/guidelines/categories'

export interface DocGuideline {
  category: GuidelineCategory
  title: string
  rule: string
  weight: number
  template?: string
}

export interface ClientGuidelineSet {
  /** Client slug (NCH already exists as `nch`). */
  slug: string
  name: string
  website?: string
  /** Template slugs this client gets; `template` on a rule must be one of these. */
  templates: string[]
  guidelines: DocGuideline[]
}

/** Shared rule: n8n bans lead-in phrases before every internal link. */
export const NO_LINK_LEAD_INS: DocGuideline = {
  category: 'blacklist',
  title: 'No link lead-ins',
  weight: 7,
  rule: 'Never introduce a link with a lead-in phrase such as "learn more about", "read our guide on", "check out" or "click here". Work the link into the sentence itself, on descriptive anchor text.',
}
