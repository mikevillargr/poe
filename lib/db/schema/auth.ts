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
