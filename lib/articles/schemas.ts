// Shared (client + server) article contract. FROZEN after foundation: change only via INITIATIVE §7.
import { z } from 'zod'

export const ARTICLE_STATUSES = ['queued', 'draft', 'in_review', 'done'] as const
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number]

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  queued: 'Queued',
  draft: 'Draft',
  in_review: 'In Review',
  done: 'Done',
}

// Manual status moves go one step forward or back. Generation moves queued → draft itself.
const ORDER: Record<ArticleStatus, number> = { queued: 0, draft: 1, in_review: 2, done: 3 }
export function canTransition(from: ArticleStatus, to: ArticleStatus): boolean {
  return Math.abs(ORDER[from] - ORDER[to]) === 1
}

/** Split a keyword cell/field on commas, semicolons, pipes or newlines; trim; dedupe (case-insensitive). */
export function splitKeywords(raw: string | string[] | null | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : (raw ?? '').split(/[,;|\n\r]+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const k = p.trim().replace(/\s+/g, ' ')
    if (!k || seen.has(k.toLowerCase())) continue
    seen.add(k.toLowerCase())
    out.push(k)
  }
  return out
}

const keywordList = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => splitKeywords(v))
  .pipe(z.array(z.string().max(120)).max(50, 'At most 50 keywords.'))

export const articleInputSchema = z.object({
  title: z.string().trim().min(1, 'Title is required.').max(300),
  brief: z.string().trim().max(10000).optional().nullable(),
  keywords: keywordList.optional().default([]),
  primaryKeyword: z.string().trim().max(120).optional().nullable(),
  targetWordCount: z.coerce.number().int().min(50).max(20000).optional().nullable(),
})
export type ArticleInput = z.input<typeof articleInputSchema>
export type ArticleInputParsed = z.output<typeof articleInputSchema>

export const citationSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().optional(),
  snippet: z.string().optional(),
})

export const researchSchema = z.object({
  summary: z.string().max(50000).optional(),
  outlineHtml: z.string().max(200000).optional(),
  citations: z.array(citationSchema).max(200).default([]),
  queries: z.array(z.string()).max(100).default([]),
})

export const articlePatchSchema = articleInputSchema
  .partial()
  .extend({
    status: z.enum(ARTICLE_STATUSES).optional(),
    draftHtml: z.string().max(2_000_000).optional().nullable(),
    research: researchSchema.optional().nullable(),
    assigneeId: z.string().uuid().optional().nullable(),
  })
export type ArticlePatch = z.input<typeof articlePatchSchema>

export const reorderSchema = z.object({
  articleId: z.string().uuid(),
  // Neighbours after the move; either may be null at the ends of the list.
  beforeId: z.string().uuid().nullable().optional(),
  afterId: z.string().uuid().nullable().optional(),
})

export interface ArticleSummary {
  id: string
  title: string
  status: ArticleStatus
  position: number
  primaryKeyword: string | null
  keywords: string[]
  targetWordCount: number | null
  wordCount: number | null
  researchStatus: 'idle' | 'running' | 'ready' | 'error'
  assigneeId: string | null
  statusChangedAt: string
  updatedAt: string
  /** D-002 (additive): content template, generation state and the "needs review" flag of a templated draft. */
  templateId?: string | null
  generationStatus?: 'idle' | 'running' | 'ready' | 'error'
  needsReview?: boolean
}

export type StatusCounts = Record<ArticleStatus, number>

export interface ArticleEventDTO {
  id: string
  articleId: string
  articleTitle: string
  type: string
  fromStatus: string | null
  toStatus: string | null
  userName: string | null
  /** Google avatar URL (users.image); null for system/import events. */
  userImage: string | null
  at: string
}
