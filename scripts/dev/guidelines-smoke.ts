// Authed smoke test for the guidelines feature (WS-guidelines, DR-006).
//   npx tsx scripts/dev/guidelines-smoke.ts http://localhost:3008
// Dev server must be running (use AI_MOCK=1 so the extract check takes the mock path).
// Mints a session for a temporary super admin (created and removed by this script, like api-sweep).
// Exercises: both pages, guideline CRUD, toggle, reorder (+ validation), extract, admin endpoints,
// and that members get 403 from admin endpoints. Expects fixture data (NCH Inc. client, member ana.santos).
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { encode } from 'next-auth/jwt'
import { requireDatabaseUrl } from '../db/env'

const BASE = process.argv[2] ?? 'http://localhost:3008'
const CLIENT = '1332ed17-3865-4e05-a78e-952cc9f83b15' // NCH Inc. (fixtures)

let failures = 0
function check(name: string, ok: boolean, extra?: unknown) {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' — ' + JSON.stringify(extra)}`)
}

async function main() {
  const db = new pg.Client({ connectionString: requireDatabaseUrl() })
  await db.connect()
  const email = `smoke-${randomUUID().slice(0, 8)}@fixture.poe.test`
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO users (email, name, role, status) VALUES ($1, 'Guidelines smoke', 'super_admin', 'active') RETURNING id`,
    [email],
  )
  const uid = rows[0].id
  const token = await encode({ token: { uid, sub: uid }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })
  const cookie = { cookie: `authjs.session-token=${token}` }
  const json = { 'content-type': 'application/json', ...cookie }

  try {
    // Pages render for an authed user
    const pageClient = await fetch(`${BASE}/c/nch/guidelines`, { headers: cookie, redirect: 'manual' })
    check('GET /c/nch/guidelines → 200', pageClient.status === 200, pageClient.status)
    const pageAdmin = await fetch(`${BASE}/admin/universal-guidelines`, { headers: cookie, redirect: 'manual' })
    check('GET /admin/universal-guidelines → 200', pageAdmin.status === 200, pageAdmin.status)

    // Client guidelines: list
    const list = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines`, { headers: cookie })
    const listBody = await list.json()
    check('GET guidelines → 200 with rows', list.status === 200 && Array.isArray(listBody.guidelines) && listBody.guidelines.length > 0, list.status)
    const seoCount = listBody.guidelines.filter((g: { category: string }) => g.category === 'seo').length

    // Create
    const created = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ category: 'seo', title: 'Smoke rule', rule: 'Temporary smoke-test rule.', weight: 7 }),
    })
    const createdBody = await created.json()
    check('POST guideline → 201', created.status === 201 && createdBody.guideline?.id, created.status)
    const gid = createdBody.guideline.id as string

    // Toggle off
    const toggled = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines/${gid}`, {
      method: 'PATCH',
      headers: json,
      body: JSON.stringify({ active: false }),
    })
    const toggledBody = await toggled.json()
    check('PATCH active=false → 200', toggled.status === 200 && toggledBody.guideline?.active === false, toggled.status)

    // Reorder within seo (put the new rule first)
    const seoIds = listBody.guidelines.filter((g: { category: string }) => g.category === 'seo').map((g: { id: string }) => g.id)
    const reorder = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines/reorder`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ category: 'seo', orderedIds: [gid, ...seoIds] }),
    })
    check('POST reorder → 200', reorder.status === 200, await reorder.text())

    // Reorder rejects ids from another category
    const badReorder = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines/reorder`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ category: 'brand', orderedIds: [gid] }),
    })
    check('POST reorder wrong category → 400', badReorder.status === 400, badReorder.status)

    // Extract (AI_MOCK=1 on the dev server → deterministic proposals)
    const extract = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines/extract`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ text: 'Our brand guidelines: always write plainly. '.repeat(3) }),
    })
    const extractBody = await extract.json()
    check('POST extract → 200 with proposals', extract.status === 200 && Array.isArray(extractBody.proposals) && extractBody.proposals.length > 0, extract.status)

    // Validation: bad category rejected
    const badCreate = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ category: 'nonsense', rule: 'x' }),
    })
    check('POST bad category → 400', badCreate.status === 400, badCreate.status)

    // Delete
    const del = await fetch(`${BASE}/api/clients/${CLIENT}/guidelines/${gid}`, { method: 'DELETE', headers: cookie })
    check('DELETE guideline → 200', del.status === 200, del.status)

    // Admin universal endpoints (super admin)
    const uni = await fetch(`${BASE}/api/admin/universal-guidelines`, { headers: cookie })
    const uniBody = await uni.json()
    check('GET universal → 200 with 50 rules', uni.status === 200 && uniBody.guidelines?.length === 50, [uni.status, uniBody.guidelines?.length])
    const uniCreate = await fetch(`${BASE}/api/admin/universal-guidelines`, {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ category: 'agency', title: 'Smoke', rule: 'Temporary universal smoke rule.' }),
    })
    const uniCreatedBody = await uniCreate.json()
    check('POST universal → 201', uniCreate.status === 201, uniCreate.status)
    if (uniCreatedBody.guideline?.id) {
      const uniDel = await fetch(`${BASE}/api/admin/universal-guidelines/${uniCreatedBody.guideline.id}`, { method: 'DELETE', headers: cookie })
      check('DELETE universal → 200', uniDel.status === 200, uniDel.status)
    }

    // Members are forbidden from admin endpoints
    const memberEmail = 'ana.santos@fixture.poe.test'
    const { rows: memberRows } = await db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [memberEmail])
    const memberToken = await encode({ token: { uid: memberRows[0].id, sub: memberRows[0].id }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })
    const memberUni = await fetch(`${BASE}/api/admin/universal-guidelines`, { headers: { cookie: `authjs.session-token=${memberToken}` } })
    check('GET universal as member → 403', memberUni.status === 403, memberUni.status)

    console.log(`(seo rules before cleanup: ${seoCount})`)
  } finally {
    await db.query('DELETE FROM users WHERE id = $1', [uid])
    await db.end()
  }

  if (failures) {
    console.error(`SMOKE FAILED: ${failures} failure(s)`)
    process.exit(1)
  }
  console.log('Guidelines smoke passed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
