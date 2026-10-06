// United Tribes blog link handling (doc: "Tribe detection and link modes", "CTA style rotation").
// The tables here are the defaults the seed copies into the client's facts; at run time the hooks receive
// the client's (editable) copies.

import { detectAll, detectFirst, matchesGroup, type KeywordGroup } from '../detect'

/** Checked in order; American is last so "Mexican American" resolves to Mexican. */
export const UT_TRIBES: KeywordGroup[] = [
  { id: 'mexican', keywords: ['mexican', 'mexico'] },
  { id: 'spanish', keywords: ['spanish', 'spain'] },
  { id: 'iranian', keywords: ['iranian', 'iran', 'persian'] },
  { id: 'paraguayan', keywords: ['paraguayan', 'paraguay'] },
  { id: 'uruguayan', keywords: ['uruguayan', 'uruguay'] },
  { id: 'panamanian', keywords: ['panamanian', 'panama'] },
  { id: 'ecuadorian', keywords: ['ecuadorian', 'ecuador'] },
  { id: 'colombian', keywords: ['colombian', 'colombia'] },
  { id: 'argentine', keywords: ['argentine', 'argentinian', 'argentina'] },
  { id: 'brazilian', keywords: ['brazilian', 'brazil'] },
  { id: 'filipino', keywords: ['filipino', 'philippines'] },
  { id: 'indian', keywords: ['indian', 'india'] },
  { id: 'vietnamese', keywords: ['vietnamese', 'vietnam'] },
  { id: 'chinese', keywords: ['chinese', 'china'] },
  { id: 'korean', keywords: ['korean', 'korea'] },
  { id: 'japanese', keywords: ['japanese', 'japan'] },
  { id: 'somali', keywords: ['somali', 'somalia'] },
  { id: 'american', keywords: ['american', 'united states', 'u.s.', 'usa'] },
]

/** Tribes with no dedicated articles that fall back to general (non-tribe) United Tribes articles. */
export const UT_GENERAL_FALLBACK = ['somali']

export const UT_CONTEXT_NOTE_GENERAL =
  'This tribe has no dedicated articles published yet, so the list above contains GENERAL / non-tribe-specific United Tribes articles instead (not about this tribe specifically). Select the most broadly relevant general-topic articles (e.g., about the business directory, multicultural community, or general United Tribes content) rather than requiring a tribe match for this selection.'
export const UT_CONTEXT_NOTE_TRIBE = 'These are dedicated articles about the same tribe/country as the current topic.'

export const noLinksMessage = (tribe: string) =>
  `NO_INTERNAL_LINKS_AVAILABLE: This is a new "${tribe}" tribe page with no published articles yet. Do not include any internal links in this blog.`

export const generalLinksMessage = (tribe: string, urls: string) =>
  `GENERAL_LINKS_ONLY (not "${tribe}"-specific — this tribe has no dedicated articles yet, these are general United Tribes articles): ${urls}`

export type LinkMode = 'all' | 'tribe' | 'general' | 'none'

export interface LinkPlan {
  mode: LinkMode
  tribes: string[]
  /** Candidate URLs for the selector (empty for `none`). */
  candidates: string[]
  contextNote: string
}

const urlHasTribe = (url: string, groups: KeywordGroup[]) => groups.some((g) => matchesGroup(url, g))

/** Standard UT blog: first detected tribe decides the candidate list. */
export function planTribeLinks(
  topic: string,
  urls: string[],
  tribes: KeywordGroup[] = UT_TRIBES,
  generalFallback: string[] = UT_GENERAL_FALLBACK,
): LinkPlan {
  const tribe = detectFirst(topic, tribes)
  if (!tribe) return withEmptyAsNone({ mode: 'all', tribes: [], candidates: urls, contextNote: UT_CONTEXT_NOTE_TRIBE })
  const own = urls.filter((u) => matchesGroup(u, tribe))
  if (own.length) return { mode: 'tribe', tribes: [tribe.id], candidates: own, contextNote: UT_CONTEXT_NOTE_TRIBE }
  if (generalFallback.includes(tribe.id)) {
    const general = urls.filter((u) => !urlHasTribe(u, tribes))
    return withEmptyAsNone({ mode: 'general', tribes: [tribe.id], candidates: general, contextNote: UT_CONTEXT_NOTE_GENERAL })
  }
  return { mode: 'none', tribes: [tribe.id], candidates: [], contextNote: UT_CONTEXT_NOTE_TRIBE }
}

/** FIFA blog: every detected tribe counts (Mexico v Argentina → both); no general fallback. */
export function planFifaLinks(topic: string, urls: string[], tribes: KeywordGroup[] = UT_TRIBES): LinkPlan {
  const found = detectAll(topic, tribes)
  if (!found.length) return withEmptyAsNone({ mode: 'all', tribes: [], candidates: urls, contextNote: '' })
  const own = urls.filter((u) => urlHasTribe(u, found))
  return own.length
    ? { mode: 'tribe', tribes: found.map((t) => t.id), candidates: own, contextNote: '' }
    : { mode: 'none', tribes: found.map((t) => t.id), candidates: [], contextNote: '' }
}

function withEmptyAsNone(plan: LinkPlan): LinkPlan {
  return plan.candidates.length ? plan : { ...plan, mode: 'none' }
}

/** The {{SELECTED_URLS}} text the writer receives for a link plan and the selector's (filtered) output. */
export function selectedUrlsText(plan: LinkPlan, selectorOutput: string): string {
  const tribe = plan.tribes[0] ?? 'this'
  if (plan.mode === 'none') return noLinksMessage(tribe)
  if (plan.mode === 'general') return generalLinksMessage(tribe, selectorOutput)
  return selectorOutput
}

/** The six CTA directions, assigned in rotation so a bulk batch doesn't repeat its closing line. */
export const UT_CTA_STYLES = [
  "INVITATION: Open with an inviting verb like 'Explore', 'Discover', or 'Step into' before the link.",
  'QUESTION-LEAD: Open the CTA with a short question directed at the reader, then resolve it with the link.',
  "BENEFIT-FIRST: Lead with the specific benefit the reader gains from this article's topic, then the link.",
  'COMMUNITY-FIRST: Center the community or business owners mentioned in the article, then the link.',
  "DIRECT-ACTION: Use an imperative, action-oriented opener like 'Head to' or 'Check out', then the link.",
  'CURIOSITY-HOOK: Reference a specific detail from the article (a dish, tradition, or event) as a teaser, then the link.',
]

export function ctaStyleFor(index: number, styles: string[] = UT_CTA_STYLES): string {
  if (!styles.length) return ''
  const i = ((Math.trunc(index) % styles.length) + styles.length) % styles.length
  return styles[i]
}
