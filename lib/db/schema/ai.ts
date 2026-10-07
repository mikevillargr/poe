import { pgTable, text, timestamp, uuid, boolean, integer, jsonb, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { aiProvider, aiModelRole } from './enums'
import { tenants } from './clients'
import { users } from './auth'
import { articles } from './articles'

// Agency-level provider keys, AES-256-GCM encrypted with APP_ENCRYPTION_KEY. Never returned to clients.
export const aiProviderCredentials = pgTable('ai_provider_credentials', {
  provider: aiProvider('provider').primaryKey(),
  keyCiphertext: text('key_ciphertext').notNull(),
  keyIv: text('key_iv').notNull(),
  keyTag: text('key_tag').notNull(),
  keyLast4: text('key_last4').notNull(),
  baseUrl: text('base_url'),
  enabled: boolean('enabled').notNull().default(true),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const aiModelRoles = pgTable('ai_model_roles', {
  role: aiModelRole('role').primaryKey(),
  provider: aiProvider('provider').notNull(),
  modelId: text('model_id').notNull(),
  params: jsonb('params').$type<{ temperature?: number; maxTokens?: number; maxSearches?: number }>(),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  role: aiModelRole('role').notNull(),
  provider: aiProvider('provider').notNull(),
  model: text('model').notNull(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  articleId: uuid('article_id').references(() => articles.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  // DR-016: wall-clock time of the call, for "usually ~N min" estimates.
  durationMs: integer('duration_ms'),
  at: timestamp('at').notNull().defaultNow(),
})
