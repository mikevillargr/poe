import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, pgEnum } from 'drizzle-orm/pg-core'

// Tables
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tenantMemberships = pgTable('tenant_memberships', {
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().$type<'admin' | 'editor' | 'viewer'>(),
})

export const guidelines = pgTable('guidelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rawText: text('raw_text').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const heuristics = pgTable('heuristics', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  sourceGuidelineId: uuid('source_guideline_id').references(() => guidelines.id, { onDelete: 'set null' }),
  category: text('category').notNull(),
  rule: text('rule').notNull(),
  weight: integer('weight').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Content uploaded for analysis
export const contentDocuments = pgTable('content_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  originalText: text('original_text').notNull(),
  editedText: text('edited_text'),
  source: text('source').notNull(), // 'url' | 'docx' | 'gdoc' | 'paste'
  sourceRef: text('source_ref'), // URL, filename, etc.
  overallScore: integer('overall_score'),
  dimensionScores: jsonb('dimension_scores').$type<Array<{ category: string; score: number; passCount: number; failCount: number }>>(),
  status: text('status').notNull().default('draft'), // 'draft' | 'scored' | 'editing' | 'finalized'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const scoreJobs = pgTable('score_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => contentDocuments.id, { onDelete: 'cascade' }),
  contentText: text('content_text').notNull(),
  contentSource: text('content_source').notNull(),
  sourceRef: text('source_ref'),
  status: text('status').notNull().default('pending'), // 'pending' | 'scoring' | 'complete' | 'error'
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

export const batchJobs = pgTable('batch_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  status: text('status').notNull().$type<'pending' | 'processing' | 'complete' | 'error'>(),
  totalItems: integer('total_items').notNull(),
  completedItems: integer('completed_items').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
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
