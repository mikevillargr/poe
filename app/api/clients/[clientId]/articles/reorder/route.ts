import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { reorderArticle } from '@/lib/articles/repo'
import { reorderSchema } from '@/lib/articles/schemas'

export const dynamic = 'force-dynamic'

// POST { articleId, beforeId?, afterId? } → { ok } (neighbours after the move)
export const POST = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { articleId, beforeId, afterId } = reorderSchema.parse(await req.json())
  await reorderArticle(client.id, articleId, beforeId, afterId)
  return json({ ok: true })
})
