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
  /**
   * Placeholders holding the candidate list. Returned URLs not in them are dropped, and the step is
   * skipped (output '') when they're all empty.
   */
  candidates: string[]
}

/** Where a placeholder's value comes from (hooks and selector steps fill the rest). */
export type ValueSource =
  | { from: 'article'; field: 'title' | 'brief' | 'primaryKeyword' }
  /** Keywords joined with ", " (`empty` when there are none). */
  | { from: 'keywords'; empty?: string }
  /** Per-row template input (`articles.template_inputs`), e.g. itemUrl. */
  | { from: 'input'; key: string; fallback?: string }
  /** The row's target word count, or the template's `defaultWordCount`. */
  | { from: 'wordCount' }
  | { from: 'currentYear' }
  /** One line per link-inventory item, e.g. `{title}-{url}`; rows missing a used field are skipped. */
  | { from: 'inventory'; inventory: string; format: string }

/** Input columns a row can carry (drives sheet/upload column mapping). */
export interface TemplateInputField {
  key: string
  label: string
  required?: boolean
  /** Header names that map to this field, e.g. ["Item URL", "Item URL (B)"]. */
  aliases?: string[]
}

export interface TemplateHookRef {
  id: string
  /** Hook-specific settings, e.g. `{ inventory: 'blog-articles' }`. */
  options?: Record<string, string>
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
  /** Hooks from `hooks/registry.ts`, run before (and some after) the selectors. */
  hooks: TemplateHookRef[]
  /** Placeholder → source. Every placeholder in a prompt needs a source, a hook or a selector output. */
  values: Record<string, ValueSource>
  /** Columns a row carries beyond the article fields. */
  inputs: TemplateInputField[]
  /** Placeholder used as the title when the model returns none (default: the article title). */
  titlePlaceholder?: string
  /** CTA targets: always allowed, and not counted as internal links. */
  ctaUrls?: string[]
  /** Lead-in phrases banned before links (default: checks.DEFAULT_LEAD_INS). */
  leadIns?: string[]
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
