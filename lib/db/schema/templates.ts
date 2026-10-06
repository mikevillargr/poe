import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  index,
  unique,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { templateKind, linkInventoryKind, inputSource, sheetTarget } from './enums'
import { tenants } from './clients'
import { users } from './auth'
import type { TemplateConfig } from '@/lib/templates/types'

// D-002: per-client content templates (presets ported from the n8n workflows), their audit trail, and the
// link inventories / Google Sheet sources that feed them.

export const contentTemplates = pgTable(
  'content_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    kind: templateKind('kind').notNull(),
    config: jsonb('config').$type<TemplateConfig>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    // Latest revision; every save writes one (content_template_revisions).
    revisionNo: integer('revision_no').notNull().default(1),
    // Per-template counter handed out as rows are created (UT CTA style rotation).
    nextSequence: integer('next_sequence').notNull().default(0),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    // Soft delete: templates referenced by articles are never hard-deleted.
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    uniqueIndex('content_templates_tenant_slug_uq').on(t.tenantId, t.slug).where(sql`${t.deletedAt} IS NULL`),
    index('content_templates_tenant_idx').on(t.tenantId),
  ],
)

export interface TemplateSnapshot {
  name: string
  slug: string
  kind: 'faq' | 'blog' | 'page'
  enabled: boolean
  config: TemplateConfig
}

export const contentTemplateRevisions = pgTable(
  'content_template_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').notNull().references(() => contentTemplates.id, { onDelete: 'cascade' }),
    revisionNo: integer('revision_no').notNull(),
    snapshot: jsonb('snapshot').$type<TemplateSnapshot>().notNull(),
    note: text('note'),
    editedBy: uuid('edited_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    editedAt: timestamp('edited_at').notNull().defaultNow(),
  },
  (t) => [unique('content_template_revisions_template_rev_uq').on(t.templateId, t.revisionNo)],
)

// created | updated | duplicated | copied | restored | enabled | disabled | deleted
export const templateEvents = pgTable(
  'template_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').notNull().references(() => contentTemplates.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    actorId: uuid('actor_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('template_events_template_idx').on(t.templateId, t.createdAt)],
)

// Candidate links for selector steps: published articles, products, pages, YouTube videos, directory pages.
export const linkInventories = pgTable(
  'link_inventories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    kind: linkInventoryKind('kind').notNull(),
    source: inputSource('source').notNull().default('upload'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [unique('link_inventories_tenant_slug_uq').on(t.tenantId, t.slug)],
)

export const linkInventoryItems = pgTable(
  'link_inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    inventoryId: uuid('inventory_id').notNull().references(() => linkInventories.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title'),
    // Extra columns: city, tribe, brand, …
    attrs: jsonb('attrs').$type<Record<string, string>>(),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('link_inventory_items_inventory_url_uq').on(t.inventoryId, t.url)],
)

export interface SheetColumnMap {
  /** Header (or column letter) per field, e.g. { title: 'Title', brief: 'Prompt', productName: 'Product Name' }. */
  [field: string]: string
}

export interface SheetSyncResult {
  at: string
  added: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

// A Google Sheet tab that Poe reads: topic rows into a template's queue, or links into an inventory.
export const sheetSources = pgTable(
  'sheet_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    spreadsheetId: text('spreadsheet_id').notNull(),
    tab: text('tab').notNull(),
    range: text('range'),
    headerRow: integer('header_row').notNull().default(1),
    columnMap: jsonb('column_map').$type<SheetColumnMap>().notNull().default({}),
    target: sheetTarget('target').notNull(),
    templateId: uuid('template_id').references(() => contentTemplates.id, { onDelete: 'set null' }),
    inventoryId: uuid('inventory_id').references(() => linkInventories.id, { onDelete: 'cascade' }),
    lastSyncedAt: timestamp('last_synced_at'),
    lastSyncResult: jsonb('last_sync_result').$type<SheetSyncResult>(),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [index('sheet_sources_tenant_idx').on(t.tenantId)],
)

// Agency-level Google service account Poe uses to read Sheets (one row). The private key is
// AES-256-GCM encrypted with APP_ENCRYPTION_KEY, like ai_provider_credentials; never returned to clients.
export const googleCredentials = pgTable('google_credentials', {
  id: text('id').primaryKey().default('service_account'),
  clientEmail: text('client_email').notNull(),
  keyCiphertext: text('key_ciphertext').notNull(),
  keyIv: text('key_iv').notNull(),
  keyTag: text('key_tag').notNull(),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
