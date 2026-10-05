// One-time step for databases whose schema was created with `drizzle-kit push` (production and
// existing dev DBs): records 0000_baseline as already applied so `db:migrate:run` starts at 0001.
//   npm run db:mark-baseline
// Refuses unless the baseline tables exist and no migrations have been recorded yet.
import { readMigrationFiles } from 'drizzle-orm/migrator'
import pg from 'pg'
import { requireDatabaseUrl, redact } from './env'

// One-time tool, already run on production (2026-10-05). Since migration 0005 the scoring tables are gone,
// so on a database migrated past 0004 this refuses by design (it is only for databases created with `db:push`).
const BASELINE_TABLES = ['tenants', 'users', 'heuristics', 'guidelines', 'content_documents', 'score_jobs']

async function main() {
  const url = requireDatabaseUrl()
  const [baseline] = readMigrationFiles({ migrationsFolder: './drizzle' })
  if (!baseline) throw new Error('No migrations found in ./drizzle')

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    const { rows: tables } = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )
    const present = new Set(tables.map((t) => t.table_name))
    const missing = BASELINE_TABLES.filter((t) => !present.has(t))
    if (missing.length) {
      throw new Error(`Not a pushed baseline database; missing tables: ${missing.join(', ')}`)
    }

    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`)
    const { rows } = await client.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations')
    if (rows[0].n > 0) {
      throw new Error(`drizzle.__drizzle_migrations already has ${rows[0].n} rows; refusing to mark baseline.`)
    }

    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [
      baseline.hash,
      baseline.folderMillis,
    ])
    console.log(`Marked 0000_baseline as applied on ${redact(url)}.`)
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
