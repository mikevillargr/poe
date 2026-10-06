// D-002 inputs end to end over HTTP (inventory upload, template import, sheet sources, Google key admin),
// against a dev server on a DB the n8n seed has run against:
//   npx tsx scripts/db/seed-n8n.ts && AI_MOCK=1 npx next dev -p 3017
//   npx tsx --env-file=.env.local scripts/dev/inputs-e2e.ts http://localhost:3017
// Creates a temporary super admin and test articles, and removes them afterwards. Makes one call to
// Google's token endpoint with a throwaway key (expected to be rejected).
import { generateKeyPairSync, randomUUID } from 'node:crypto'
import pg from 'pg'
import { encode } from 'next-auth/jwt'

const BASE = process.argv[2] ?? 'http://localhost:3017'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
let cookie = ''
let failures = 0
const createdArticles: string[] = []

function check(ok: boolean, label: string) {
  console.log(`${ok ? '  ✔' : '  ✖'} ${label}`)
  if (!ok) failures++
}

async function call<T = Record<string, unknown>>(path: string, init: { method?: string; json?: unknown; form?: FormData } = {}) {
  const res = await fetch(BASE + path, {
    method: init.method ?? (init.json || init.form ? 'POST' : 'GET'),
    headers: { cookie, ...(init.json ? { 'Content-Type': 'application/json' } : {}) },
    body: init.form ?? (init.json ? JSON.stringify(init.json) : undefined),
  })
  return { status: res.status, body: (await res.json().catch(() => ({}))) as T }
}

function csvForm(name: string, csv: string, fields: Record<string, string> = {}) {
  const f = new FormData()
  f.append('file', new Blob([csv], { type: 'text/csv' }), name)
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  return f
}

const clientId = async (slug: string) => (await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug])).rows[0].id as string
async function templateId(client: string, slug: string) {
  const { body } = await call<{ templates: { id: string; slug: string }[] }>(`/api/clients/${client}/templates`)
  return body.templates.find((t) => t.slug === slug)!.id
}

async function main() {
  const email = `inputs-e2e-${randomUUID().slice(0, 8)}@fixture.poe.test`
  const user = (await pool.query(`INSERT INTO users (email, name, status, role) VALUES ($1, 'Inputs e2e', 'active', 'super_admin') RETURNING id`, [email])).rows[0].id
  cookie = `authjs.session-token=${await encode({ token: { uid: user, sub: user }, secret: process.env.AUTH_SECRET!, salt: 'authjs.session-token' })}`
  try {
    console.log('Link inventory upload')
    const tb = await clientId('tenderbites')
    const up = await call(`/api/clients/${tb}/inventories/blog-articles/upload`, {
      form: csvForm('tb.csv', 'Blog Page,Live URL\nGrill guide,https://tenderbites.ph/blogs/grill\nDraft,\nKasim,https://tenderbites.ph/blogs/kasim\n'),
    })
    check(up.status === 200 && up.body.items === 2, `TB blog-articles replaced with ${up.body.items} links`)
    const inv = await call<{ inventories: { slug: string; items: number; source: string }[] }>(`/api/clients/${tb}/inventories`)
    check(inv.body.inventories.find((i) => i.slug === 'blog-articles')?.items === 2, 'inventory list shows 2 items, source upload')
    const tws = await clientId('the-watch-store-ph')
    const p = await call<{ sample: { url: string }[] }>(`/api/clients/${tws}/inventories/products/upload`, {
      form: csvForm('products.csv', 'URL\ntissot-prx-40\n/seiko-5\n', { urlPrefix: 'https://thewatchstore.ph/products/', dryRun: 'true' }),
    })
    check(p.body.sample?.[0]?.url === 'https://thewatchstore.ph/products/tissot-prx-40', 'slugs + urlPrefix → product URLs (dry run)')
    const none = await call(`/api/clients/${tb}/inventories/blog-articles/upload`, { form: csvForm('x.csv', 'Notes\nhello\n') })
    check(none.status === 400, 'a file without URLs is rejected (400)')

    console.log('Template import from a file')
    const nch = await clientId('nch')
    const nchBlog = await templateId(nch, 'blog')
    const sheet = 'Title,Prompt,SEO Keywords,Number of Words\nHow Much Does a Nevada LLC Cost?,Fee guide,"nevada llc cost, nevada llc fees",1500-2000\n,orphan,,\nWyoming vs Nevada LLC,,,\n'
    const dry = await call<{ added: number; dryRun: boolean }>(`/api/clients/${nch}/templates/${nchBlog}/import`, { form: csvForm('nch.csv', sheet, { dryRun: 'true' }) })
    check(dry.status === 200 && dry.body.dryRun && dry.body.added === 2, 'dry run: 2 rows (blank title skipped), nothing written')
    const imp = await call<{ added: number }>(`/api/clients/${nch}/templates/${nchBlog}/import`, { form: csvForm('nch.csv', sheet) })
    check(imp.status === 201 && imp.body.added === 2, 'import: 2 articles queued')
    const rows = (
      await pool.query(
        `SELECT id, title, template_id, template_inputs, target_word_count, keywords FROM articles WHERE tenant_id = $1 AND title = ANY($2) ORDER BY position`,
        [nch, ['How Much Does a Nevada LLC Cost?', 'Wyoming vs Nevada LLC']],
      )
    ).rows
    createdArticles.push(...rows.map((r) => r.id))
    check(rows.length === 2 && rows.every((r) => r.template_id === nchBlog), 'articles set to the NCH Grail blog template')
    check(rows[0].template_inputs?.wordCount === '1500-2000' && rows[0].target_word_count === 2000 && rows[0].keywords.length === 2, 'word count text kept for the prompt; keywords split')

    const ut = await clientId('united-tribes')
    const utBlog = await templateId(ut, 'blog')
    const utImp = await call(`/api/clients/${ut}/templates/${utBlog}/import`, { form: csvForm('ut.csv', 'Title,Prompt\nMexican Bakeries,a\nFilipino Fiestas,b\nKorean BBQ,c\n') })
    const utRows = (await pool.query(`SELECT id, template_inputs FROM articles WHERE tenant_id = $1 AND import_batch_id IS NOT NULL ORDER BY position DESC LIMIT 3`, [ut])).rows.reverse()
    createdArticles.push(...utRows.map((r) => r.id))
    const idx = utRows.map((r) => r.template_inputs.ctaIndex)
    check(utImp.status === 201 && idx[1] === idx[0] + 1 && idx[2] === idx[0] + 2, `UT import assigns CTA indexes in sheet order (${idx.join(', ')})`)

    console.log('Sheet sources + Google key')
    const src = await call<{ sources: { id: string; target: string; name: string }[] }>(`/api/clients/${nch}/sheet-sources`)
    check(src.body.sources.length === 3, `NCH has ${src.body.sources.length} sheet sources`)
    const topics = src.body.sources.find((s) => s.target === 'topics')!
    const notConnected = await call<{ code: string }>(`/api/clients/${nch}/sheet-sources/${topics.id}/sync`, { json: { fromRow: 2, dryRun: true } })
    check(notConnected.status === 503 && notConnected.body.code === 'SHEETS_NOT_CONFIGURED', 'sync without a Google key → 503 SHEETS_NOT_CONFIGURED')

    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
    const keyFile = JSON.stringify({ type: 'service_account', client_email: 'poe-e2e@example.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() })
    const bad = await call(`/api/admin/google`, { method: 'PUT', json: { serviceAccountJson: '{"type":"authorized_user","client_id":"x","client_secret":"y","refresh_token":"z"}' } })
    check(bad.status === 400, 'a non-service-account key file is rejected')
    const put = await call<{ configured: boolean; clientEmail: string }>(`/api/admin/google`, { method: 'PUT', json: { serviceAccountJson: keyFile } })
    check(put.body.configured && put.body.clientEmail === 'poe-e2e@example.iam.gserviceaccount.com', 'key stored (encrypted); only the email comes back')
    const stored = (await pool.query(`SELECT key_ciphertext FROM google_credentials`)).rows[0]?.key_ciphertext as string
    check(!!stored && !stored.includes('PRIVATE KEY'), 'stored ciphertext holds no plaintext key')
    const first = await call<{ code: string; error: string }>(`/api/clients/${nch}/sheet-sources/${topics.id}/sync`, { json: {} })
    check(first.status === 400 && /First sync/.test(first.body.error ?? ''), 'first topic sync needs fromRow (so old n8n rows aren’t re-queued)')
    const auth = await call<{ code: string }>(`/api/clients/${nch}/sheet-sources/${topics.id}/sync`, { json: { fromRow: 2, dryRun: true } })
    check(auth.body.code === 'SHEETS_AUTH', `a throwaway key is rejected by Google → ${auth.body.code}`)
    const del = await call<{ configured: boolean }>(`/api/admin/google`, { method: 'DELETE' })
    check(del.body.configured === false, 'key removed')
  } finally {
    if (createdArticles.length) await pool.query('DELETE FROM articles WHERE id = ANY($1)', [createdArticles])
    await pool.query('DELETE FROM google_credentials')
    await pool.query('DELETE FROM users WHERE id = $1', [user])
    await pool.end()
  }
  console.log(failures ? `\n${failures} check(s) failed.` : '\nInputs e2e passed.')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
