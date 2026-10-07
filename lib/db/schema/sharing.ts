import { sql } from 'drizzle-orm'
import { boolean, customType, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { tenants } from './clients'
import { articles } from './articles'

// DR-021: shareable article previews, stakeholder comments, in-app notifications (with an email outbox),
// agency branding, and Google Doc reuse for bulk export.

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

/** One living link per article (a revoked link stays as a row; a new one gets a new token). */
export const articleShares = pgTable(
  'article_shares',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    showComments: boolean('show_comments').notNull().default(true),
    showRules: boolean('show_rules').notNull().default(true),
    showHistory: boolean('show_history').notNull().default(true),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: timestamp('last_viewed_at'),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    revokedAt: timestamp('revoked_at'),
  },
  (t) => [uniqueIndex('article_shares_active_uq').on(t.articleId).where(sql`${t.revokedAt} is null`)],
)

export type CommentAnchor = { quote: string; prefix: string; suffix: string }

/** A comment on a shared article, by a guest (name, optional email) or a signed-in staff member. */
export const shareComments = pgTable(
  'share_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    shareId: uuid('share_id').references(() => articleShares.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => shareComments.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    guestName: text('guest_name'),
    guestEmail: text('guest_email'),
    /** sha256 of the guest's browser key, so a guest can edit or delete their own comment. */
    guestKeyHash: text('guest_key_hash'),
    body: text('body').notNull(),
    anchor: jsonb('anchor').$type<CommentAnchor>(),
    status: text('status').notNull().default('open'), // 'open' | 'resolved' (top-level only)
    resolvedBy: uuid('resolved_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    editedAt: timestamp('edited_at'),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [index('share_comments_article_idx').on(t.articleId, t.createdAt)],
)

/** In-app notifications; `email_status` makes this the outbox for email later (no schema change needed). */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id').references(() => articles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    readAt: timestamp('read_at'),
    emailStatus: text('email_status'), // 'pending' | 'skipped' | 'sent' | 'failed'
    emailedAt: timestamp('emailed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt)],
)

/** App-wide settings by key (e.g. `branding`). */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
  updatedBy: uuid('updated_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/** Small binary assets kept in the DB (the agency logo); production has no uploads volume. */
export const appAssets = pgTable('app_assets', {
  key: text('key').primaryKey(),
  mime: text('mime').notNull(),
  data: bytea('data').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

/** The last Google Doc made for an article, reused while the draft is unchanged (bulk export). */
export const articleExports = pgTable(
  'article_exports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    articleId: uuid('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'google_doc'
    url: text('url').notNull(),
    draftHash: text('draft_hash').notNull(),
    createdBy: uuid('created_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('article_exports_article_idx').on(t.articleId, t.kind, t.createdAt)],
)
