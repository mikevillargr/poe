import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const { Pool } = pg

let db: ReturnType<typeof drizzle> | null = null

if (process.env.DATABASE_URL) {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL })
    db = drizzle(pool)
    console.log('Database connected:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'))
  } catch (error) {
    console.error('Database connection failed:', error)
  }
} else {
  console.warn('DATABASE_URL not set — using file-based fallback storage')
}

export { db }
