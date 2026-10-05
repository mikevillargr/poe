import * as dotenv from 'dotenv'

// Same precedence as drizzle.config.ts: .env.local, then the process environment.
dotenv.config({ path: '.env.local' })

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set (checked .env.local and the environment).')
    process.exit(1)
  }
  return url
}

export function redact(url: string): string {
  return url.replace(/:[^:@/]+@/, ':***@')
}
