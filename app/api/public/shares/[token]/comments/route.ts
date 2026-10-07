import { z } from 'zod'
import { json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { publicRoute } from '@/lib/api/public'
import { addComment, latestDecision, listThreads } from '@/lib/comments/repo'
import { anchorSchema, commentBodySchema, guestEmailSchema, guestKey, guestNameSchema, rateLimit, requireComments, requireShare } from '@/lib/shares/guest'

export const dynamic = 'force-dynamic'

type P = { token: string }

// GET → { threads, decision } (DR-021). `x-poe-guest` marks the caller's own comments.
export const GET = publicRoute<P>(async ({ req, params }) => {
  const share = await requireShare(params.token)
  const [threads, decision] = await Promise.all([
    share.showComments ? listThreads(share.articleId, { guestKey: guestKey(req) }) : Promise.resolve([]),
    latestDecision(share.articleId),
  ])
  return json({ threads, decision, commentsOn: share.showComments })
})

const bodySchema = z.object({
  name: guestNameSchema,
  email: guestEmailSchema,
  body: commentBodySchema,
  anchor: anchorSchema.nullish(),
  parentId: z.string().uuid().nullish(),
})

// POST { name, email?, body, anchor?, parentId? } → 201 { id }
export const POST = publicRoute<P>(async ({ req, params }) => {
  const share = await requireShare(params.token)
  requireComments(share)
  const key = guestKey(req)
  if (!key) throw Errors.badRequest('Missing guest key')
  rateLimit(req, params.token, 'comment', 20)
  const b = bodySchema.parse(await req.json())
  const row = await addComment({
    tenantId: share.tenantId,
    articleId: share.articleId,
    shareId: share.id,
    parentId: b.parentId ?? null,
    author: { guestName: b.name, guestEmail: b.email || null, guestKey: key },
    body: b.body,
    anchor: b.anchor ?? null,
  })
  return json(row, { status: 201 })
})
