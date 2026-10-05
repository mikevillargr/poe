import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'

// The pool connects lazily, so importing this at build time is safe; queries fail loudly at runtime
// if DATABASE_URL is missing. There is no file-based fallback any more.
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'test') {
  console.warn('DATABASE_URL is not set; database queries will fail.')
}

const globalForDb = globalThis as unknown as { poePool?: pg.Pool }

const pool = globalForDb.poePool ?? new pg.Pool({ connectionString: process.env.DATABASE_URL })
if (process.env.NODE_ENV !== 'production') globalForDb.poePool = pool

export const db = drizzle(pool, { schema })
export type Db = typeof db
