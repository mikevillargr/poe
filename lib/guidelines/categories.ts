// Canonical guideline categories (DR-006). This is also the prompt/display order: hard
// constraints first, the AI-tell blacklist last so it's freshest in the prompt.
export const GUIDELINE_CATEGORIES = [
  'seo',
  'structure',
  'readability',
  'sourcing',
  'brand',
  'agency',
  'client',
  'blacklist',
] as const
export type GuidelineCategory = (typeof GUIDELINE_CATEGORIES)[number]

export const CATEGORY_LABELS: Record<GuidelineCategory, string> = {
  seo: 'SEO',
  structure: 'Structure',
  readability: 'Readability',
  sourcing: 'Sourcing',
  brand: 'Brand voice',
  agency: 'Agency rules',
  client: 'Client rules',
  blacklist: 'Blacklist: words, phrases and patterns that make text sound AI-written. Never use them',
}

// Short labels for compact UI (badges, selects) — CATEGORY_LABELS stays the long, prompt-facing copy.
export const CATEGORY_SHORT_LABELS: Record<GuidelineCategory, string> = {
  seo: 'SEO',
  structure: 'Structure',
  readability: 'Readability',
  sourcing: 'Sourcing',
  brand: 'Brand',
  agency: 'Agency',
  client: 'Client',
  blacklist: 'Blacklist',
}

export function categoryLabel(c: string): string {
  return CATEGORY_LABELS[c as GuidelineCategory] ?? c.charAt(0).toUpperCase() + c.slice(1)
}

export function categoryShortLabel(c: string): string {
  return CATEGORY_SHORT_LABELS[c as GuidelineCategory] ?? c.charAt(0).toUpperCase() + c.slice(1)
}

// Unknown (custom) categories rank just before the blacklist.
export function categoryRank(c: string): number {
  const i = GUIDELINE_CATEGORIES.indexOf(c as GuidelineCategory)
  return i === -1 ? GUIDELINE_CATEGORIES.length - 1 - 0.5 : i
}
