import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { recordArticleEvent } from '@/lib/articles/provenance'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const clip = (n: number) => z.string().max(20_000).transform((s) => s.slice(0, n))

// DR-020: things that only happen in the browser report themselves here (allow-list only).
const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ai_edit_applied'),
    mode: z.enum(['improve', 'insert']),
    instruction: clip(500).optional(),
    original: clip(2000).optional(),
    replacement: clip(2000),
  }),
  z.object({ type: z.literal('exported'), format: z.literal('docx') }),
])

// POST { type, ... } → 201 { ok: true }
export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const { type, ...payload } = bodySchema.parse(await req.json())
  await recordArticleEvent(db, { tenantId: client.id, articleId: article.id, userId: user.id, type, payload })
  return json({ ok: true }, { status: 201 })
})
