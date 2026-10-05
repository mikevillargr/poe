// Scoring-era tables. Read-only after the Content Hub migration (content_documents are copied into
// articles); dropped one release later in a double-confirmed migration. Don't build on these.
import { pgTable, text, timestamp, uuid, integer, jsonb } from 'drizzle-orm/pg-core'
import { tenants } from './clients'
import { heuristics } from './guidelines'

export const contentDocuments = pgTable('content_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  originalText: text('original_text').notNull(),
  editedText: text('edited_text'),
  source: text('source').notNull(),
  sourceRef: text('source_ref'),
  overallScore: integer('overall_score'),
  dimensionScores: jsonb('dimension_scores').$type<Array<{ category: string; score: number; passCount: number; failCount: number }>>(),
  status: text('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const batchJobs = pgTable('batch_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  status: text('status').notNull().$type<'pending' | 'processing' | 'complete' | 'error'>(),
  totalItems: integer('total_items').notNull(),
  completedItems: integer('completed_items').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const scoreJobs = pgTable('score_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => contentDocuments.id, { onDelete: 'cascade' }),
  contentText: text('content_text').notNull(),
  contentSource: text('content_source').notNull(),
  sourceRef: text('source_ref'),
  status: text('status').notNull().default('pending'),
  overallScore: integer('overall_score'),
  dimensionScores: jsonb('dimension_scores').$type<Array<{ category: string; score: number; passCount: number; failCount: number }>>(),
  suggestions: jsonb('suggestions'),
  errorMsg: text('error_msg'),
  batchJobId: uuid('batch_job_id').references(() => batchJobs.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const editSuggestions = pgTable('edit_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  jobId: uuid('job_id').notNull().references(() => scoreJobs.id, { onDelete: 'cascade' }),
  heuristicId: uuid('heuristic_id').notNull().references(() => heuristics.id, { onDelete: 'set null' }),
  type: text('type').notNull().$type<'insert' | 'replace' | 'delete'>(),
  originalText: text('original_text').notNull(),
  suggestedText: text('suggested_text'),
  charStart: integer('char_start').notNull(),
  charEnd: integer('char_end').notNull(),
  reason: text('reason').notNull(),
  severity: text('severity').notNull().$type<'high' | 'medium' | 'low'>(),
  status: text('status').notNull().$type<'pending' | 'accepted' | 'denied' | 'modified'>().default('pending'),
  userModifiedText: text('user_modified_text'),
})

export const batchJobItems = pgTable('batch_job_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  batchJobId: uuid('batch_job_id').notNull().references(() => batchJobs.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<'url' | 'docx' | 'csv_row'>(),
  ref: text('ref').notNull(),
  status: text('status').notNull().$type<'pending' | 'processing' | 'complete' | 'error'>(),
  scoreJobId: uuid('score_job_id').references(() => scoreJobs.id, { onDelete: 'set null' }),
  errorMsg: text('error_msg'),
})
