import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { setThreadStatus } from '@/lib/comments/repo'
import { Errors } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

// PATCH { status: 'open' | 'resolved' } → { ok }
export const PATCH = withRoute<{ clientId: string; articleId: string; commentId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const { status } = z.object({ status: z.enum(['open', 'resolved']) }).parse(await req.json())
  if (!z.string().uuid().safeParse(params.commentId).success) throw Errors.notFound('Comment')
  await setThreadStatus(client.id, article.id, params.commentId, status, user.id)
  return json({ ok: true })
})
