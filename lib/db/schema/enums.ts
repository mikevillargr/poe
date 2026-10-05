import { pgEnum } from 'drizzle-orm/pg-core'

export const userRole = pgEnum('user_role', ['super_admin', 'member'])
export const userStatus = pgEnum('user_status', ['pending', 'active', 'disabled'])

export const articleStatus = pgEnum('article_status', ['queued', 'draft', 'in_review', 'done'])
export const researchStatus = pgEnum('research_status', ['idle', 'running', 'ready', 'error'])
export const articleVersionKind = pgEnum('article_version_kind', [
  'generated',
  'manual',
  'suggestion_applied',
  'restore',
  'imported',
  'revised',
])

export const guidelineSource = pgEnum('guideline_source', ['manual', 'ingested', 'template_copy'])

export const aiProvider = pgEnum('ai_provider', ['anthropic', 'openai', 'moonshot'])
export const aiModelRole = pgEnum('ai_model_role', ['generation', 'research'])

export type UserRole = (typeof userRole.enumValues)[number]
export type UserStatus = (typeof userStatus.enumValues)[number]
export type ArticleStatus = (typeof articleStatus.enumValues)[number]
export type ResearchStatus = (typeof researchStatus.enumValues)[number]
export type ArticleVersionKind = (typeof articleVersionKind.enumValues)[number]
export type GuidelineSource = (typeof guidelineSource.enumValues)[number]
export type AIProviderId = (typeof aiProvider.enumValues)[number]
export type AIModelRole = (typeof aiModelRole.enumValues)[number]
