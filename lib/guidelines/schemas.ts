// Shared (client + server) guidelines contract: zod schemas and the DTO the API returns.
import { z } from 'zod'
import type { heuristics, universalGuidelines } from '@/lib/db/schema'
import type { GuidelineSource } from '@/lib/db/schema'
import { GUIDELINE_CATEGORIES } from './categories'

export const guidelineCategoryEnum = z.enum(GUIDELINE_CATEGORIES)

export const guidelineInputSchema = z.object({
  category: guidelineCategoryEnum,
  title: z.string().trim().min(1).max(120).optional().nullable(),
  rule: z.string().trim().min(1).max(2000),
  weight: z.number().int().min(1).max(10).default(5),
  active: z.boolean().default(true),
})
export type GuidelineInput = z.output<typeof guidelineInputSchema>

export const guidelineUpdateSchema = guidelineInputSchema.partial()
export type GuidelineUpdate = z.output<typeof guidelineUpdateSchema>

export const reorderSchema = z.object({
  category: guidelineCategoryEnum,
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
})
export type ReorderInput = z.output<typeof reorderSchema>

export const extractRequestSchema = z.object({
  text: z.string().trim().min(50).max(50000),
  sourceRef: z.string().trim().max(500).optional(),
})
export type ExtractRequest = z.output<typeof extractRequestSchema>

export const extractedRuleSchema = z.object({
  category: guidelineCategoryEnum,
  title: z.string().trim().max(120).optional().nullable(),
  rule: z.string().trim().min(1).max(2000),
  weight: z.number().int().min(1).max(10).default(5),
})
export type ExtractedRule = z.output<typeof extractedRuleSchema>

type GuidelineRow = typeof heuristics.$inferSelect
type UniversalGuidelineRow = typeof universalGuidelines.$inferSelect

export interface GuidelineDTO {
  id: string
  category: string
  title: string | null
  rule: string
  weight: number
  active: boolean
  source?: GuidelineSource
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function toGuidelineDTO(row: GuidelineRow): GuidelineDTO {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    rule: row.rule,
    weight: row.weight,
    active: row.active,
    source: row.source,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toUniversalGuidelineDTO(row: UniversalGuidelineRow): GuidelineDTO {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    rule: row.rule,
    weight: row.weight,
    active: row.active,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
