import { pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { userRole, userStatus } from './enums'

// Google OAuth users. Access requires status 'active'; new @growth-rocket.com sign-ins start 'pending'.
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  image: text('image'),
  googleSub: text('google_sub').unique(),
  role: userRole('role').notNull().default('member'),
  status: userStatus('status').notNull().default('pending'),
  approvedBy: uuid('approved_by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
  approvedAt: timestamp('approved_at'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// DR-014: a person's own Google Drive connection for exporting to Google Docs. Holds a refresh token for the
// `drive.file` scope (only files Poe creates), AES-256-GCM encrypted like the provider keys. Never sent to the browser.
export const userGoogleDrive = pgTable('user_google_drive', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  googleEmail: text('google_email').notNull(),
  keyCiphertext: text('key_ciphertext').notNull(),
  keyIv: text('key_iv').notNull(),
  keyTag: text('key_tag').notNull(),
  scope: text('scope'),
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
