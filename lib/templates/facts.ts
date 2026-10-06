// Client facts the template hooks read (tenants.settings.templateFacts). Editable data, not code: the
// United Tribes tribe map and CTA styles, FIFA host cities, and the product-page scraping settings.
// Anything missing falls back to the defaults in hooks/*.
import { z } from 'zod'
import { FIFA_CITIES, type City } from './hooks/city-directory'
import { TWS_DESCRIPTION_CLASSES } from './hooks/product-page'
import { UT_CTA_STYLES, UT_GENERAL_FALLBACK, UT_TRIBES } from './hooks/united-tribes'
import type { KeywordGroup } from './detect'

export const templateFactsSchema = z.object({
  utTribes: z.array(z.object({ id: z.string().min(1), keywords: z.array(z.string().min(1)).min(1) })).optional(),
  utGeneralFallback: z.array(z.string()).optional(),
  utCtaStyles: z.array(z.string().min(1)).optional(),
  fifaCities: z.array(z.object({ name: z.string().min(1), aliases: z.array(z.string().min(1)).min(1) })).optional(),
  /** Classes of the product description block, e.g. ["product__description", "rte", "quick-add-hidden"]. */
  productPageClasses: z.array(z.string().min(1)).optional(),
  /** Hosts the product-page hook may fetch (no other host is ever requested). */
  productPageHosts: z.array(z.string().min(1)).optional(),
})
export type TemplateFacts = z.infer<typeof templateFactsSchema>

export interface ResolvedFacts {
  utTribes: KeywordGroup[]
  utGeneralFallback: string[]
  utCtaStyles: string[]
  fifaCities: City[]
  productPageClasses: string[]
  productPageHosts: string[]
}

/** Reads `settings.templateFacts`, ignoring anything invalid, and fills in the defaults. */
export function resolveFacts(settings: Record<string, unknown> | null | undefined): ResolvedFacts {
  const parsed = templateFactsSchema.safeParse(settings?.templateFacts ?? {})
  const f = parsed.success ? parsed.data : {}
  return {
    utTribes: f.utTribes ?? UT_TRIBES,
    utGeneralFallback: f.utGeneralFallback ?? UT_GENERAL_FALLBACK,
    utCtaStyles: f.utCtaStyles ?? UT_CTA_STYLES,
    fifaCities: f.fifaCities ?? FIFA_CITIES,
    productPageClasses: f.productPageClasses ?? TWS_DESCRIPTION_CLASSES,
    productPageHosts: f.productPageHosts ?? [],
  }
}
