// Seeds the agency Universal guidelines template (lib/guidelines/universal-template.ts, DR-006).
//   npx tsx scripts/db/seed-universal.ts [--force]
// Uses DATABASE_URL from .env.local or the environment. Idempotent: a non-empty
// universal_guidelines table is left untouched unless --force, which replaces all rows.
// Safe to run repeatedly. Agents never run this against production — Mike does.
import { drizzle } from 'drizzle-orm/node-postgres'
import { count } from 'drizzle-orm'
import pg from 'pg'
import * as schema from '../../lib/db/schema'
import { UNIVERSAL_TEMPLATE } from '../../lib/guidelines/universal-template'
import { requireDatabaseUrl, redact } from './env'

async function main() {
  const url = requireDatabaseUrl()
  const force = process.argv.includes('--force')
  const pool = new pg.Pool({ connectionString: url })
  const db = drizzle(pool, { schema })

  try {
    const [row] = await db.select({ n: count() }).from(schema.universalGuidelines)
    if (row.n > 0 && !force) {
      console.log(`universal_guidelines already contains ${row.n} rules — leaving as is. Re-run with --force to replace.`)
      return
    }

    await db.transaction(async (tx) => {
      if (row.n > 0) {
        await tx.delete(schema.universalGuidelines)
        console.log(`--force: deleted ${row.n} existing rules.`)
      }
      await tx.insert(schema.universalGuidelines).values(
        UNIVERSAL_TEMPLATE.map((g, i) => ({ ...g, active: g.active ?? true, sortOrder: (i + 1) * 1024 })),
      )
    })

    const counts = new Map<string, number>()
    for (const g of UNIVERSAL_TEMPLATE) counts.set(g.category, (counts.get(g.category) ?? 0) + 1)
    console.log(`Seeded ${UNIVERSAL_TEMPLATE.length} universal guidelines into ${redact(url)}:`)
    for (const [category, n] of counts) console.log(`  ${category}: ${n}`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
