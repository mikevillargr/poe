import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'

// Make database optional - will use in-memory storage if not configured
let db: any = null

if (process.env.DATABASE_URL) {
  try {
    const sql = neon(process.env.DATABASE_URL)
    db = drizzle(sql)
  } catch (error) {
    console.warn('Database connection failed, will use in-memory storage:', error)
  }
} else {
  console.warn('DATABASE_URL not set, using in-memory storage')
}

export { db }
