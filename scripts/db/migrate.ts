// Applies pending drizzle/ migrations. This is the only supported way to change a real database's
// schema; `drizzle-kit push` is for throwaway local databases only.
//   npm run db:migrate:run
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import { requireDatabaseUrl, redact } from './env'

async function main() {
  const url = requireDatabaseUrl()
  const pool = new pg.Pool({ connectionString: url })
  console.log(`Migrating ${redact(url)}`)
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' })
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations',
    )
    console.log(`Done. ${rows[0].n} migrations recorded.`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
