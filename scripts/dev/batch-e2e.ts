// DR-017 + the full-pipeline batch, end to end over HTTP against a dev server in mock mode, on a DB the n8n seed has
// run against:
//   AI_MOCK=1 npx next dev -p 3019
//   npx tsx --env-file=.env.local scripts/dev/batch-e2e.ts http://localhost:3019
// Creates a temporary active user and test articles on TenderBites, and removes them afterwards.
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { encode } from 'next-auth/jwt'

const BASE = process.argv[2] ?? 'http://localhost:3019'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let cookie = ''
const created: string[] = []
let failures = 0

function check(ok: boolean, label: string) {
  console.log(`${ok ? '  ✔' : '  ✖'} ${label}`)
  if (!ok) failures++
}

async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(BASE + path, {
    method: init.method,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    headers: { 'Content-Type': 'application/json', cookie },
  })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T }
}

async function main() {
  const email = `batch-e2e-${randomUUID().slice(0, 8)}@fixture.poe.test`
  const { rows } = await pool.query(`INSERT INTO users (email, name, status, role) VALUES ($1, 'Batch e2e', 'active', 'member') RETURNING id`, [email])
  const userId = rows[0].id
  cookie = `authjs.session-token=${await encode({ token: { uid: userId, sub: userId }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })}`

  try {
    const { rows: c } = await pool.query(`SELECT id FROM tenants WHERE slug = 'tenderbites'`)
    if (!c[0]) throw new Error('TenderBites not found: run scripts/db/seed-n8n.ts first.')
    const clientId: string = c[0].id
    const { body: tpls } = await api<{ templates: { id: string; slug: string }[] }>(`/api/clients/${clientId}/templates`)
    const blog = tpls.templates.find((t) => t.slug === 'blog')
    if (!blog) throw new Error('TenderBites blog template missing')

    console.log('Create 5 standard + 2 templated topics (research defaults on)')
    const ids: string[] = []
    for (let i = 1; i <= 7; i++) {
      const { body } = await api<{ article: { id: string; researchEnabled?: boolean } }>(`/api/clients/${clientId}/articles`, {
        method: 'POST',
        body: { title: `Batch e2e topic ${i} ${randomUUID().slice(0, 4)}`, brief: 'A short brief for the batch test', keywords: ['grilled pork', 'tenderbites'] },
      })
      created.push(body.article.id)
      ids.push(body.article.id)
      if (i === 1) check(body.article.researchEnabled === true, 'a new topic starts with research on')
      if (i > 5) await api(`/api/clients/${clientId}/articles/${body.article.id}/template`, { method: 'PUT', body: { templateId: blog.id, inputs: {} } })
    }
    const off = [ids[0], ids[1], ids[5]] // two standard, one templated
    const on = ids.filter((id) => !off.includes(id))

    console.log('Research off for 3 topics (one call, like the bulk bar)')
    const set = await api<{ updated: string[]; skipped: string[] }>(`/api/clients/${clientId}/articles/research-setting`, {
      method: 'PATCH',
      body: { articleIds: off, on: false },
    })
    check(set.status === 200 && set.body.updated.length === 3 && set.body.skipped.length === 0, `research-setting updated ${set.body.updated?.length}`)
    const bad = await api(`/api/clients/${clientId}/articles/research-setting`, { method: 'PATCH', body: { articleIds: [], on: true } })
    check(bad.status === 400, `empty selection rejected (${bad.status})`)

    console.log('Generate the 7 (research first where on, 3 at a time)')
    const start = await api<{ queued: number }>(`/api/clients/${clientId}/articles/generate-batch`, { method: 'POST', body: { articleIds: ids } })
    check(start.status === 202 && start.body.queued === 7, `batch queued ${start.body.queued}`)
    type Item = { articleId: string; state: string; step?: string; research: boolean }
    type Status = { finished: boolean; counts: Record<string, number>; items: Item[] }
    let status: Status | null = null
    let maxRunning = 0
    const sawStep = new Set<string>()
    for (let i = 0; i < 240; i++) {
      await new Promise((r) => setTimeout(r, 250))
      status = (await api<{ batch: Status | null }>(`/api/clients/${clientId}/articles/generate-batch`)).body.batch
      if (!status) continue
      maxRunning = Math.max(maxRunning, status.counts.running ?? 0)
      for (const it of status.items) if (it.step) sawStep.add(it.step)
      if (status.finished) break
    }
    check(!!status?.finished, `batch finished: ${JSON.stringify(status?.counts)}`)
    check(maxRunning <= 3, `never more than 3 at once (max seen ${maxRunning})`)
    // Mock research is quicker than the poll, so only "writing" is reliably caught mid-flight; the research itself is
    // verified from the database below.
    check(sawStep.has('writing'), `steps seen while polling: ${[...sawStep].join(', ')}`)
    const plan = new Map(status?.items.map((it) => [it.articleId, it.research]))
    check(on.every((id) => plan.get(id) === true) && off.every((id) => plan.get(id) === false), 'research planned exactly for the topics that have it on')

    const { rows: after } = await pool.query(`SELECT id, status, research_status, research, template_id, draft_html FROM articles WHERE id = ANY($1)`, [ids])
    const byId = new Map(after.map((r) => [r.id, r]))
    check(on.every((id) => byId.get(id)?.research_status === 'ready' && byId.get(id)?.research), 'the 4 "on" topics were researched')
    check(off.every((id) => byId.get(id)?.research_status === 'idle' && !byId.get(id)?.research), 'the 3 "off" topics were not')
    check(ids.every((id) => byId.get(id)?.status === 'draft' && (byId.get(id)?.draft_html ?? '').length > 50), 'all 7 have a draft')

    const { rows: events } = await pool.query(
      `SELECT article_id, payload FROM article_events WHERE article_id = ANY($1) AND type = 'generated'`,
      [[ids[6]]],
    )
    const used = events[0]?.payload?.usedResearch
    check(used === true, `templated topic with research on drafted with the research brief (usedResearch=${used})`)
  } finally {
    if (created.length) await pool.query('DELETE FROM articles WHERE id = ANY($1)', [created])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    await pool.end()
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nBatch e2e passed.')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
