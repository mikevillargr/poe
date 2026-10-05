import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  doublePrecision,
  index,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { guidelineSource } from './enums'
import { tenants } from './clients'
import { users } from './auth'

// Raw documents guidelines were ingested from. Physical name stays `guidelines`.
export const guidelineSources = pgTable('guidelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rawText: text('raw_text').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Agency-level template. A new client starts with a copy of these rows.
export const universalGuidelines = pgTable('universal_guidelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  title: text('title'),
  rule: text('rule').notNull(),
  weight: integer('weight').notNull().default(5),
  active: boolean('active').notNull().default(true),
  sortOrder: doublePrecision('sort_order').notNull().default(0),
  createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Per-client guidelines. Physical name stays `heuristics`; code calls them guidelines.
export const heuristics = pgTable(
  'heuristics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    sourceGuidelineId: uuid('source_guideline_id').references(() => guidelineSources.id, { onDelete: 'set null' }),
    category: text('category').notNull(),
    title: text('title'),
    rule: text('rule').notNull(),
    weight: integer('weight').notNull(),
    active: boolean('active').notNull().default(true),
    source: guidelineSource('source').notNull().default('manual'),
    templateId: uuid('template_id').references(() => universalGuidelines.id, { onDelete: 'set null' }),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('heuristics_tenant_category_idx').on(t.tenantId, t.category)],
)

export const guidelines = heuristics
