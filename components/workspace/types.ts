// Client-side shapes for the Article Workspace (WS workspace).
import type { ArticleStatus } from '@/lib/articles/schemas'
import type { WorkspaceResearch } from '@/lib/pipeline/schemas'
import type { GenerationMeta, OptimizeResult } from '@/lib/db/schema/articles'

export interface WorkspaceArticle {
  id: string
  tenantId: string
  status: ArticleStatus
  title: string
  brief: string | null
  primaryKeyword: string | null
  keywords: string[]
  targetWordCount: number | null
  research: WorkspaceResearch | null
  researchStatus: 'idle' | 'running' | 'ready' | 'error'
  researchModel: string | null
  researchStartedAt: string | null
  generationStatus: 'idle' | 'running' | 'ready' | 'error'
  generationStartedAt: string | null
  draftHtml: string | null
  draftModel: string | null
  wordCount: number | null
  assigneeId: string | null
  updatedAt: string
  /** D-002: the article's content template (null = the standard research → generate flow). */
  templateId: string | null
  templateInputs: Record<string, string | number | null>
  generationMeta: GenerationMeta | null
  /** DR-017: research before writing for this topic. */
  researchEnabled: boolean
  /** The last guideline check: scores and suggestions with what was done to them. */
  lastOptimize: OptimizeResult | null
}

export interface WorkspaceClient {
  id: string
  slug: string
  name: string
}

export interface WorkspacePerson {
  id: string
  name: string | null
  email: string
  image: string | null
}

/** The configured role models (provider:model), or why they're unavailable. */
export interface ModelsInUse {
  research: string | null
  generation: string | null
}

type Raw = Record<string, unknown>

/** Picks the workspace fields from a full article row (API JSON or a JSON-roundtripped DB row). */
export function toWorkspaceArticle(raw: Raw): WorkspaceArticle {
  const r = raw as Record<string, never>
  const research = raw.research as WorkspaceResearch | null
  return {
    id: r.id,
    tenantId: r.tenantId,
    status: r.status,
    title: r.title,
    brief: r.brief ?? null,
    primaryKeyword: r.primaryKeyword ?? null,
    keywords: (raw.keywords as string[] | null) ?? [],
    targetWordCount: r.targetWordCount ?? null,
    research: research
      ? {
          summary: research.summary ?? '',
          outlineHtml: research.outlineHtml ?? '',
          citations: Array.isArray(research.citations) ? research.citations : [],
          queries: Array.isArray(research.queries) ? research.queries : [],
        }
      : null,
    researchStatus: r.researchStatus,
    researchModel: r.researchModel ?? null,
    researchStartedAt: r.researchStartedAt ?? null,
    generationStatus: r.generationStatus ?? 'idle',
    generationStartedAt: r.generationStartedAt ?? null,
    draftHtml: r.draftHtml ?? null,
    draftModel: r.draftModel ?? null,
    wordCount: r.wordCount ?? null,
    assigneeId: r.assigneeId ?? null,
    updatedAt: String(raw.updatedAt),
    templateId: r.templateId ?? null,
    researchEnabled: r.researchEnabled ?? true,
    templateInputs: (raw.templateInputs as Record<string, string | number | null> | null) ?? {},
    generationMeta: (raw.generationMeta as GenerationMeta | null) ?? null,
    lastOptimize: (raw.lastOptimize as OptimizeResult | null) ?? null,
  }
}

export function hasResearch(a: Pick<WorkspaceArticle, 'research'>): boolean {
  const r = a.research
  return !!r && !!(r.summary?.trim() || r.outlineHtml?.trim() || r.citations.length)
}

export function hasDraft(a: Pick<WorkspaceArticle, 'draftHtml' | 'wordCount'>): boolean {
  return !!a.draftHtml && (a.wordCount ?? 1) > 0
}
