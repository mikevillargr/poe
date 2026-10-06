import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  integer,
  doublePrecision,
  index,
  primaryKey,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { guidelineSource } from './enums'
import { tenants } from './clients'
import { users } from './auth'
import { contentTemplates } from './templates'

// Raw documents guidelines were ingested from. Physical name stays `guidelines`.
export const guidelineSources = pgTable('guidelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rawText: text('raw_text').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Agency-wide rules (D-003): every client follows the live set first, then its own rules (client rules win on
// conflict). A client can switch an individual rule off (`client_universal_overrides`).
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
    // Before D-003: the Universal rule this was copied from. No longer written; migration 0008 removed the copies.
    templateId: uuid('template_id').references(() => universalGuidelines.id, { onDelete: 'set null' }),
    // D-002: set = the rule applies only to articles made with this content template; null = whole client.
    contentTemplateId: uuid('content_template_id').references((): AnyPgColumn => contentTemplates.id, { onDelete: 'set null' }),
    sortOrder: doublePrecision('sort_order').notNull().default(0),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('heuristics_tenant_category_idx').on(t.tenantId, t.category)],
)

export const guidelines = heuristics

// D-003: a client's switch for one Universal rule. No row = on (the Universal rule's own `active` still applies).
export const clientUniversalOverrides = pgTable(
  'client_universal_overrides',
  {
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    universalGuidelineId: uuid('universal_guideline_id')
      .notNull()
      .references(() => universalGuidelines.id, { onDelete: 'cascade' }),
    active: boolean('active').notNull(),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.universalGuidelineId] })],
)
