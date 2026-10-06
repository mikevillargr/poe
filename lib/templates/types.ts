// Content templates (D-002): per-client presets ported from the n8n workflows. This file is the data
// shape a template has once stored; the engine modules next to it are pure functions over that shape.

export type TemplateKind = 'faq' | 'blog' | 'page'

/** How parsed sections become one Markdown document. */
export type AssemblyRecipe =
  | 'raw' // whole cleaned response (product FAQs)
  | 'meta-blog' // TB, UT, FIFA: H1, meta lines, main, conclusion
  | 'tws-blog' // + Key Takeaways and FAQ, with heading safety nets
  | 'nch-blog' // + summary, takeaways, verdict, FAQ, expert tips
  | 'tribe-page' // UT community page: starts at "## Summary"

/** A link-selection call that runs before the writer and fills one placeholder. */
export interface SelectorStep {
  id: string
  prompt: string
  maxTokens: number
  /** Placeholder the cleaned output is written to, e.g. `SELECTED_URLS`. */
  output: string
  /** `urls`: comma list. `sections`: ARTICLE_URLS / PRODUCT_URLS blocks. `single-url`: one URL. */
  format: 'urls' | 'sections' | 'single-url'
}

export interface Range {
  min: number
  max: number
}

/** A word that may only appear in a sentence that also names one of `allowedWith`. */
export interface ProximityRule {
  terms: string[]
  allowedWith: string[]
  label: string
}

export interface CheckConfig {
  /** Markers whose content must be non-empty. Defaults to every template marker. */
  requiredMarkers?: string[]
  /** Fractional slack on `wordCount` (0.1 = ±10%), for prompts that say "about". */
  wordCountTolerance?: number
  h2?: Range
  h3?: Range
  /** Count of question headings inside one marker section (or the whole document). */
  questions?: Range & { level: 2 | 3; section?: string }
  lists?: (Range & { section: string; label: string })[]
  links?: Partial<Range> & { label?: string }
  /** Every link must point at a supplied URL (selector output, directory links, CTA). */
  onlySuppliedUrls?: boolean
  bannedPhrases?: string[]
  proximity?: ProximityRule[]
  noEmDash?: boolean
  metaTitleMax?: number
  metaDescriptionMax?: number
  conclusionHeaderWords?: Range
  /** Every H2 ends with "?" (NCH). */
  h2Questions?: boolean
}

export interface TemplateConfig {
  kind: TemplateKind
  selectors: SelectorStep[]
  writerPrompt: string
  writerMaxTokens: number
  /** Output markers in order, e.g. `['ARTICLE_TITLE', 'META_TITLE', …]`. Empty for marker-less FAQs. */
  markers: string[]
  assembly: AssemblyRecipe
  /** Blog-only cleanup: strip `**` in table rows, drop blank lines between headings. */
  blogCleanup: boolean
  /** Used when the row has no word count, e.g. `1500-2500`. */
  defaultWordCount?: string
  /** Hook ids from `hooks/registry.ts`, run before the selectors. */
  hooks: string[]
  checks: CheckConfig
  researchEnabled: boolean
}

export interface CheckResult {
  id: string
  ok: boolean
  message: string
}

export interface AssembledOutput {
  markdown: string
  title: string
  metaTitle?: string
  metaDescription?: string
  tldr?: string
  /** Parsed marker sections (empty for marker-less templates). */
  sections: Record<string, string>
}
