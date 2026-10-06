// zod contract for a stored template config (content_templates.config). Shared by the seed, the runtime
// (which re-validates what it reads) and the future template editor API.
import { z } from 'zod'
import { listPlaceholders } from './placeholders'
import { isTemplateHook } from './hooks/registry'
import type { TemplateConfig } from './types'

const range = z.object({ min: z.number().int().min(0), max: z.number().int().min(0) })
const placeholderName = z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Use UPPER_SNAKE_CASE')
const marker = z.string().regex(/^[A-Z][A-Z0-9_]*$/)

const valueSource = z.discriminatedUnion('from', [
  z.object({ from: z.literal('article'), field: z.enum(['title', 'brief', 'primaryKeyword']) }),
  z.object({ from: z.literal('keywords'), empty: z.string().optional() }),
  z.object({ from: z.literal('input'), key: z.string().min(1), fallback: z.string().optional() }),
  z.object({ from: z.literal('wordCount') }),
  z.object({ from: z.literal('currentYear') }),
  z.object({ from: z.literal('inventory'), inventory: z.string().min(1), format: z.string().min(1) }),
])

export const checkConfigSchema = z.object({
  requiredMarkers: z.array(marker).optional(),
  wordCountTolerance: z.number().min(0).max(0.5).optional(),
  h2: range.optional(),
  h3: range.optional(),
  questions: range.extend({ level: z.union([z.literal(2), z.literal(3)]), section: marker.optional() }).optional(),
  lists: z.array(range.extend({ section: marker, label: z.string() })).optional(),
  links: z.object({ min: z.number().int().optional(), max: z.number().int().optional(), label: z.string().optional() }).optional(),
  onlySuppliedUrls: z.boolean().optional(),
  bannedPhrases: z.array(z.string().min(1)).optional(),
  proximity: z.array(z.object({ terms: z.array(z.string().min(1)), allowedWith: z.array(z.string().min(1)), label: z.string() })).optional(),
  noEmDash: z.boolean().optional(),
  metaTitleMax: z.number().int().positive().optional(),
  metaDescriptionMax: z.number().int().positive().optional(),
  conclusionHeaderWords: range.optional(),
  h2Questions: z.boolean().optional(),
})

export const templateConfigSchema = z
  .object({
    kind: z.enum(['faq', 'blog', 'page']),
    selectors: z.array(
      z.object({
        id: z.string().min(1),
        prompt: z.string().min(1).max(50_000),
        maxTokens: z.number().int().min(50).max(64_000),
        output: placeholderName,
        format: z.enum(['urls', 'sections', 'single-url']),
        candidates: z.array(placeholderName),
      }),
    ),
    writerPrompt: z.string().min(1).max(100_000),
    writerMaxTokens: z.number().int().min(256).max(64_000),
    markers: z.array(marker),
    assembly: z.enum(['raw', 'meta-blog', 'tws-blog', 'nch-blog', 'tribe-page']),
    blogCleanup: z.boolean(),
    defaultWordCount: z.string().max(40).optional(),
    hooks: z.array(z.object({ id: z.string().refine(isTemplateHook, 'Unknown hook'), options: z.record(z.string()).optional() })),
    values: z.record(placeholderName, valueSource),
    inputs: z.array(z.object({ key: z.string().min(1), label: z.string().min(1), required: z.boolean().optional(), aliases: z.array(z.string()).optional() })),
    titlePlaceholder: placeholderName.optional(),
    ctaUrls: z.array(z.string().url()).optional(),
    leadIns: z.array(z.string().min(1)).optional(),
    checks: checkConfigSchema,
    researchEnabled: z.boolean(),
  })
  .superRefine((c, ctx) => {
    const missing = unresolvedPlaceholders(c as TemplateConfig)
    if (missing.length) ctx.addIssue({ code: 'custom', message: `No source for: ${missing.map((m) => `{{${m}}}`).join(', ')}` })
  })

/** Placeholders each hook fills (kept next to the hook registry's descriptions). */
export const HOOK_OUTPUTS: Record<string, string[]> = {
  'product-page': ['PRODUCT_DETAILS'],
  'ut-tribe-links': ['AGGREGATED_URLS', 'CONTEXT_NOTE'],
  'ut-cta-style': ['CTA_STYLE'],
  'fifa-links': ['AGGREGATED_URLS'],
  'fifa-city-directory': ['CITY_DIRECTORY_LINKS', 'DETECTED_CITY'],
  'tribe-page-inputs': [],
}

/** Prompt placeholders with no value source, hook or selector output (save-time guard). */
export function unresolvedPlaceholders(c: TemplateConfig): string[] {
  const provided = new Set<string>([
    ...Object.keys(c.values),
    ...c.selectors.map((s) => s.output),
    ...c.hooks.flatMap((h) => HOOK_OUTPUTS[h.id] ?? []),
    'GUIDELINES',
  ])
  const used = [c.writerPrompt, ...c.selectors.map((s) => s.prompt)].flatMap(listPlaceholders)
  return [...new Set(used)].filter((p) => !provided.has(p))
}

export function parseTemplateConfig(raw: unknown): TemplateConfig {
  return templateConfigSchema.parse(raw) as TemplateConfig
}
