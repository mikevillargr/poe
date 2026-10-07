import { z } from 'zod'
import { json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { publicRoute } from '@/lib/api/public'
import { guestDeleteComment, guestEditComment } from '@/lib/comments/repo'
import { commentBodySchema, guestKey, rateLimit, requireComments, requireShare } from '@/lib/shares/guest'

export const dynamic = 'force-dynamic'

type P = { token: string; commentId: string }

const uuid = z.string().uuid()

// PATCH { body } → { ok } (a guest editing their own comment)
export const PATCH = publicRoute<P>(async ({ req, params }) => {
  const share = await requireShare(params.token)
  requireComments(share)
  const key = guestKey(req)
  if (!key || !uuid.safeParse(params.commentId).success) throw Errors.notFound('Comment')
  rateLimit(req, params.token, 'comment', 20)
  const { body } = z.object({ body: commentBodySchema }).parse(await req.json())
  await guestEditComment(share.articleId, params.commentId, key, body)
  return json({ ok: true })
})

// DELETE → { ok } (a guest deleting their own comment)
export const DELETE = publicRoute<P>(async ({ req, params }) => {
  const share = await requireShare(params.token)
  requireComments(share)
  const key = guestKey(req)
  if (!key || !uuid.safeParse(params.commentId).success) throw Errors.notFound('Comment')
  await guestDeleteComment(share.articleId, params.commentId, key)
  return json({ ok: true })
})
