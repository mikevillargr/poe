import { pgTable, text, timestamp, uuid, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './auth'

// A client is a tenant: its own guidelines, queue and articles. The physical table keeps the
// `tenants` name (and `tenant_id` FKs everywhere); code and UI call it a client.
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logoUrl: text('logo_url'),
  website: text('website'),
  notes: text('notes'),
  settings: jsonb('settings').$type<Record<string, unknown>>(),
  createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const clients = tenants
