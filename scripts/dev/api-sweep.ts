// Access sweep over every app/api/**/route.ts (Phase 0 exit criterion; run before every merge).
//   npx tsx scripts/dev/api-sweep.ts [baseUrl]        (dev server must be running)
// Checks: (1) without a session every non-public route/method → 401;
//         (2) with a pending user's session nothing returns 2xx.
// Needs AUTH_SECRET + DATABASE_URL (.env.local). Creates/removes a temporary pending user.
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { encode } from 'next-auth/jwt'
import { requireDatabaseUrl } from '../db/env'

const BASE = process.argv[2] ?? 'http://localhost:3002'
const PUBLIC = [/^\/api\/auth(\/|$)/, /^\/api\/health$/]
const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const
const DUMMY = '00000000-0000-0000-0000-000000000000'

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return routes(p)
    return name === 'route.ts' ? [p] : []
  })
}

function toUrlPath(file: string) {
  return (
    '/' +
    file
      .replace(/^app\//, '')
      .replace(/\/route\.ts$/, '')
      .replace(/\[\.\.\.[^\]]+\]/g, 'session')
      .replace(/\[[^\]]+\]/g, DUMMY)
  )
}

async function main() {
  const db = new pg.Client({ connectionString: requireDatabaseUrl() })
  await db.connect()
  const email = `sweep-${randomUUID().slice(0, 8)}@fixture.poe.test`
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (email, name, status) VALUES ($1, 'API sweep', 'pending') RETURNING id`,
    [email],
  )
  const token = await encode({ token: { uid: rows[0].id, sub: rows[0].id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })

  const failures: string[] = []
  let checked = 0
  try {
    for (const file of routes('app/api').sort()) {
      const path = toUrlPath(file)
      if (PUBLIC.some((re) => re.test(path))) continue
      for (const method of METHODS) {
        const init = { method, redirect: 'manual' as const, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{}' }
        const anon = await fetch(BASE + path, init)
        if (anon.status !== 401) failures.push(`${method} ${path}: no session → ${anon.status} (want 401)`)
        const pending = await fetch(BASE + path, { ...init, headers: { ...init.headers, cookie: `authjs.session-token=${token}` } })
        if (pending.status >= 200 && pending.status < 300) failures.push(`${method} ${path}: pending user → ${pending.status} (want non-2xx)`)
        checked += 2
      }
    }
  } finally {
    await db.query('DELETE FROM users WHERE id = $1', [rows[0].id])
    await db.end()
  }

  if (failures.length) {
    console.error(`API sweep FAILED (${failures.length} of ${checked} checks):\n  ` + failures.join('\n  '))
    process.exit(1)
  }
  console.log(`API sweep passed: ${checked} checks across ${routes('app/api').length} route files.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
