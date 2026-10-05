import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  doublePrecision,
  jsonb,
  index,
  unique,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { articleStatus, researchStatus, articleVersionKind } from './enums'
import { tenants } from './clients'
import { users } from './auth'

export interface ResearchCitation {
  id: string
  url: string
  title?: string
  snippet?: string
}

export interface ArticleResearch {
  summary?: string
  outlineHtml?: string
  citations: ResearchCitation[]
  queries: string[]
}

export interface OptimizeResult {
  ranAt: string
  overallScore?: number
  keywordCoverage?: Array<{ keyword: string; count: number; inTitle: boolean; inIntro: boolean; inHeading: boolean }>
  dimensionScores?: Array<{ category: string; score: number; passCount: number; failCount: number }>
}

export const importBatches = pgTable('import_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rowCount: integer('row_count').notNull().default(0),
  errors: jsonb('errors').$type<Array<{ row: number; message: string }>>(),
  createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// One row per queue item, through its whole life: queued → draft → in_review → done.
export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    position: doublePrecision('position').notNull(),
    status: articleStatus('status').notNull().default('queued'),
    statusChangedAt: timestamp('status_changed_at').notNull().defaultNow(),

    title: text('title').notNull(),
    brief: text('brief'),
    primaryKeyword: text('primary_keyword'),
    keywords: text('keywords').array().notNull().default([]),
    targetWordCount: integer('target_word_count'),

    research: jsonb('research').$type<ArticleResearch>(),
    researchStatus: researchStatus('research_status').notNull().default('idle'),
    researchModel: text('research_model'),
    researchStartedAt: timestamp('research_started_at'),
    // Same enum as research_status (idle|running|ready|error).
    generationStatus: researchStatus('generation_status').notNull().default('idle'),
    generationStartedAt: timestamp('generation_started_at'),

    draftHtml: text('draft_html'),
    draftModel: text('draft_model'),
    wordCount: integer('word_count'),
    lastOptimize: jsonb('last_optimize').$type<OptimizeResult>(),

    assigneeId: uuid('assignee_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('articles_tenant_status_idx').on(t.tenantId, t.status),
    index('articles_tenant_position_idx').on(t.tenantId, t.position),
  ],
)

export const articleVersions = pgTable(
  'article_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    versionNo: integer('version_no').notNull(),
    html: text('html').notNull(),
    kind: articleVersionKind('kind').notNull(),
    label: text('label'),
    wordCount: integer('word_count'),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('article_versions_article_version_uq').on(t.articleId, t.versionNo)],
)

export const articleEvents = pgTable(
  'article_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'created' | 'status_changed' | 'researched' | 'generated' | 'imported' | ...
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    userId: uuid('user_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    at: timestamp('at').notNull().defaultNow(),
  },
  (t) => [index('article_events_tenant_at_idx').on(t.tenantId, t.at)],
)
