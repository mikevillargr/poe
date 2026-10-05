// Shared (client + server) contracts for the research / generate / versions routes (WS pipeline +
// workspace). Not part of the frozen lib/articles/schemas.ts contract.
import { z } from 'zod'
import { citationSchema, researchSchema } from '@/lib/articles/schemas'
import type { ArticleVersionKind } from '@/lib/db/schema/enums'

// Citations can be excluded from the draft (DR-005 sub-decision 3). The frozen `citationSchema`
// has no field for that, so the flag lives in the research jsonb next to the citation and is only
// written through PATCH …/research (the generic article PATCH would strip it).
// TODO(§7): add `excluded?: boolean` to citationSchema in lib/articles/schemas.ts.
export const workspaceCitationSchema = citationSchema.extend({ excluded: z.boolean().optional() })
export type WorkspaceCitation = z.infer<typeof workspaceCitationSchema>

export const workspaceResearchSchema = researchSchema.extend({
  citations: z.array(workspaceCitationSchema).max(200).default([]),
})
export type WorkspaceResearch = z.infer<typeof workspaceResearchSchema>

/** PATCH …/research: edit the persisted research brief in place. Omitted fields are unchanged. */
export const researchEditSchema = z.object({
  summary: z.string().max(50000).optional(),
  outlineHtml: z.string().max(200000).optional(),
  /** Full list of excluded citation ids (replaces the previous set). */
  excludedCitationIds: z.array(z.string()).max(200).optional(),
})
export type ResearchEdit = z.infer<typeof researchEditSchema>

/** POST …/generate body. */
export const generateBodySchema = z.object({
  /** Use the article's research brief (summary, outline, included sources). Default: true if research exists. */
  useResearch: z.boolean().optional(),
})

/** POST …/revise body. */
export const reviseBodySchema = z.object({
  feedback: z.string().trim().min(1, 'Tell Poe what to change.').max(4000),
})

/** POST …/versions body. */
export const createVersionSchema = z.object({
  label: z.string().trim().max(120).optional(),
})

export interface ArticleVersionDTO {
  id: string
  versionNo: number
  kind: ArticleVersionKind
  label: string | null
  wordCount: number | null
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

export interface ArticleVersionWithHtml extends ArticleVersionDTO {
  html: string
}
