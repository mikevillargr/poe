import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { addComment, latestDecision, listThreads } from '@/lib/comments/repo'
import { anchorSchema, commentBodySchema } from '@/lib/shares/guest'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string }

// GET → { threads, decision } (DR-021: the workspace Comments panel)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const article = await getArticle(client.id, params.articleId)
  const [threads, decision] = await Promise.all([listThreads(article.id), latestDecision(article.id)])
  return json({ threads, decision })
})

// POST { body, parentId?, anchor? } → 201 { id } (a reply or comment from staff)
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const b = z.object({ body: commentBodySchema, parentId: z.string().uuid().nullish(), anchor: anchorSchema.nullish() }).parse(await req.json())
  const row = await addComment({ tenantId: client.id, articleId: article.id, shareId: null, parentId: b.parentId ?? null, author: { userId: user.id }, body: b.body, anchor: b.anchor ?? null })
  return json(row, { status: 201 })
})
