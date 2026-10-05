import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticleReconciled } from '@/lib/pipeline/runs'
import { deleteArticle, updateArticle } from '@/lib/articles/repo'
import { articlePatchSchema } from '@/lib/articles/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string }

// GET → { article } (full row: brief, keywords, research, draftHtml, ...)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json({ article: await getArticleReconciled(client.id, params.articleId) })
})

// PATCH (any subset of articlePatchSchema) → { article }. Status moves one step at a time.
export const PATCH = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const patch = articlePatchSchema.parse(await req.json())
  const article = await updateArticle(client.id, params.articleId, patch, user)
  return json({ article })
})

export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await deleteArticle(client.id, params.articleId)
  return json({ ok: true })
})
