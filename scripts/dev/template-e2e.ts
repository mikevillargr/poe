// D-002 end to end over HTTP against a dev server in mock mode, on a DB the n8n seed has run against:
//   npx tsx scripts/db/seed-n8n.ts && AI_MOCK=1 npx next dev -p 3016
//   npx tsx --env-file=.env.local scripts/dev/template-e2e.ts http://localhost:3016
// Creates a temporary active user and test articles, and removes them afterwards.
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { encode } from 'next-auth/jwt'
import { readSSE } from '@/lib/ai/client/readSSE'
import type { AIStreamEvent } from '@/lib/ai/types'

const BASE = process.argv[2] ?? 'http://localhost:3016'
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

async function generate(clientId: string, articleId: string): Promise<AIStreamEvent[]> {
  const res = await fetch(`${BASE}/api/clients/${clientId}/articles/${articleId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: '{}',
  })
  if (!res.ok) throw new Error(`generate → ${res.status} ${await res.text()}`)
  const events: AIStreamEvent[] = []
  for await (const ev of readSSE(res)) events.push(ev)
  return events
}

async function client(slug: string): Promise<string> {
  const { rows } = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug])
  if (!rows[0]) throw new Error(`Client ${slug} not found: run scripts/db/seed-n8n.ts first.`)
  return rows[0].id
}

async function newArticle(clientId: string, title: string, brief: string, templateSlug: string, inputs: Record<string, unknown> = {}) {
  const { body } = await api<{ article: { id: string } }>(`/api/clients/${clientId}/articles`, { method: 'POST', body: { title, brief } })
  created.push(body.article.id)
  const { body: tpls } = await api<{ templates: { id: string; slug: string }[] }>(`/api/clients/${clientId}/templates`)
  const t = tpls.templates.find((x) => x.slug === templateSlug)!
  const set = await api<{ article: { templateInputs: Record<string, unknown> } }>(`/api/clients/${clientId}/articles/${body.article.id}/template`, {
    method: 'PUT',
    body: { templateId: t.id, inputs },
  })
  return { id: body.article.id, inputs: set.body.article.templateInputs }
}

async function seedInventory(clientId: string, slug: string, urls: string[]) {
  const { rows } = await pool.query('SELECT id FROM link_inventories WHERE tenant_id = $1 AND slug = $2', [clientId, slug])
  for (const [i, url] of urls.entries()) {
    await pool.query('INSERT INTO link_inventory_items (inventory_id, url, title, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [rows[0].id, url, url.split('/').pop(), i])
  }
}

async function meta(articleId: string) {
  const { rows } = await pool.query('SELECT draft_html, status, generation_status, generation_meta FROM articles WHERE id = $1', [articleId])
  return rows[0]
}

async function main() {
  const email = `tpl-e2e-${randomUUID().slice(0, 8)}@fixture.poe.test`
  const { rows } = await pool.query(`INSERT INTO users (email, name, status, role) VALUES ($1, 'Template e2e', 'active', 'member') RETURNING id`, [email])
  const userId = rows[0].id
  cookie = `authjs.session-token=${await encode({ token: { uid: userId, sub: userId }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })}`

  try {
    console.log('TenderBites blog (selector + writer + checks)')
    const tb = await client('tenderbites')
    await seedInventory(tb, 'blog-articles', ['https://tenderbites.ph/blogs/grill', 'https://tenderbites.ph/blogs/kasim', 'https://tenderbites.ph/blogs/steak'])
    const tbArticle = await newArticle(tb, 'How to Grill Ribeye at Home', 'A home grilling guide', 'blog')
    const ev = await generate(tb, tbArticle.id)
    const steps = ev.filter((e) => e.type === 'step').map((e) => (e.type === 'step' ? e.step : ''))
    check(steps.includes('selecting') && steps.includes('writing') && steps.includes('checking'), `steps: ${steps.join(' → ')}`)
    check(ev.some((e) => e.type === 'saved'), 'saved event')
    const m = await meta(tbArticle.id)
    check(m.draft_html?.startsWith('<h1>How to Grill Ribeye at Home</h1>'), 'draft is HTML with the H1')
    check(m.status === 'draft' && m.generation_status === 'ready', `status ${m.status} / ${m.generation_status}`)
    check(m.generation_meta?.selectedLinks?.length === 3 && m.generation_meta?.metaTitle === 'Mock meta title', 'generation_meta: links + meta title')
    console.log(`    checks failed: ${m.generation_meta.checks.filter((c: { ok: boolean }) => !c.ok).map((c: { message: string }) => c.message).join('; ') || 'none'} · needsReview=${m.generation_meta.needsReview} · retried=${m.generation_meta.retried}`)

    console.log('United Tribes blog (tribe links, CTA rotation)')
    const ut = await client('united-tribes')
    await seedInventory(ut, 'blog-articles', ['https://unitedtribes.com/pulse/mexican-day-of-the-dead', 'https://unitedtribes.com/pulse/filipino-noche-buena'])
    const a1 = await newArticle(ut, 'Mexican Bakeries in Chicago', 'pan dulce guide', 'blog')
    const a2 = await newArticle(ut, 'Korean Barbecue in LA', 'kbbq guide', 'blog')
    check(typeof a1.inputs.ctaIndex === 'number' && a2.inputs.ctaIndex === (a1.inputs.ctaIndex as number) + 1, `ctaIndex assigned in order (${a1.inputs.ctaIndex}, ${a2.inputs.ctaIndex})`)
    await generate(ut, a1.id)
    const u1 = await meta(a1.id)
    check(u1.generation_meta?.selectedLinks?.[0]?.includes('mexican'), 'Mexican article only links Mexican articles')
    check(!!u1.generation_meta?.ctaStyle, `CTA style: ${u1.generation_meta?.ctaStyle?.split(':')[0]}`)

    console.log('TWS product FAQ (product page on a disallowed host fails cleanly)')
    const tws = await client('the-watch-store-ph')
    const f = await newArticle(tws, 'Tissot PRX 40mm', '', 'product-faq', { itemUrl: 'https://example.org/products/prx' })
    const fe = await generate(tws, f.id)
    const err = fe.find((e) => e.type === 'error')
    check(!!err && err.type === 'error' && err.code === 'PRODUCT_PAGE', `error event: ${err && err.type === 'error' ? err.message : 'none'}`)
    check((await meta(f.id)).generation_status === 'error', 'generation_status = error')

    console.log('LFP batch (two queued articles, two at a time)')
    const lfp = await client('levittown-ford-parts')
    await seedInventory(lfp, 'interlink-pages', ['https://levittownfordparts.com/returns', 'https://levittownfordparts.com/shipping'])
    await seedInventory(lfp, 'products', ['https://levittownfordparts.com/p/f150-mats', 'https://levittownfordparts.com/p/f150-cover', 'https://levittownfordparts.com/p/bronco-rack'])
    const b1 = await newArticle(lfp, 'Ford F-150 Tonneau Cover', '', 'product-faq')
    const b2 = await newArticle(lfp, '2024 Mustang GT Spoiler', '', 'product-faq')
    const start = await api<{ queued: number }>(`/api/clients/${lfp}/articles/generate-batch`, { method: 'POST', body: { articleIds: [b1.id, b2.id] } })
    check(start.status === 202 && start.body.queued === 2, `batch queued ${start.body.queued}`)
    type BatchStatus = { finished: boolean; counts: Record<string, number> }
    let status: BatchStatus | null = null
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 500))
      status = (await api<{ batch: BatchStatus | null }>(`/api/clients/${lfp}/articles/generate-batch`)).body.batch
      if (status?.finished) break
    }
    check(!!status?.finished && (status!.counts.done ?? 0) + (status!.counts['needs-review'] ?? 0) === 2, `batch finished: ${JSON.stringify(status?.counts)}`)
    const lm = await meta(b1.id)
    check(lm.draft_html?.includes('<h2>') && !lm.draft_html.includes('<h1>'), 'FAQ draft: H2 questions, no H1')
  } finally {
    if (created.length) await pool.query('DELETE FROM articles WHERE id = ANY($1)', [created])
    await pool.query('DELETE FROM users WHERE id = $1', [userId])
    await pool.end()
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nTemplate e2e passed.')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
