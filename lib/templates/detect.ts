// Whole-word keyword detection (United Tribes tribe and host-city detection). A keyword only counts when
// it isn't part of a longer word: "india" doesn't match "Indiana", "la" never matches "Atlanta".

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function containsWholeWord(text: string, keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  if (!k) return false
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(k)}(?![a-z0-9])`, 'i').test(text)
}

export interface KeywordGroup {
  id: string
  keywords: string[]
}

/** First group, in list order, with a keyword in the text (order matters: American is last). */
export function detectFirst(text: string, groups: KeywordGroup[]): KeywordGroup | null {
  return groups.find((g) => g.keywords.some((k) => containsWholeWord(text, k))) ?? null
}

/** Every group with a keyword in the text, in list order (a match-up can return two tribes). */
export function detectAll(text: string, groups: KeywordGroup[]): KeywordGroup[] {
  return groups.filter((g) => g.keywords.some((k) => containsWholeWord(text, k)))
}

export function matchesGroup(text: string, group: KeywordGroup): boolean {
  return group.keywords.some((k) => containsWholeWord(text, k))
}
