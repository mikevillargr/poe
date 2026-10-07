import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { getActiveShare, getOrCreateShare, revokeShare, toShareDTO, updateShareSettings } from '@/lib/shares/repo'
import { Errors } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string }

// GET → { share: ShareDTO | null } (DR-021).
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const article = await getArticle(client.id, params.articleId)
  const share = await getActiveShare(client.id, article.id)
  return json({ share: share ? toShareDTO(share) : null })
})

// POST { reset? } → { share }: the article's link, created on first use; `reset` issues a new token.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const { reset } = z.object({ reset: z.boolean().optional() }).parse(await req.json().catch(() => ({})))
  const share = reset ? await revokeShare(client.id, article.id, user.id, true) : await getOrCreateShare(client.id, article.id, user.id)
  return json({ share: toShareDTO(share!) })
})

const settingsSchema = z
  .object({ showComments: z.boolean(), showRules: z.boolean(), showHistory: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update')

// PATCH { showComments?, showRules?, showHistory? } → { share }
export const PATCH = withRoute<P>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  const share = await updateShareSettings(client.id, article.id, settingsSchema.parse(await req.json()))
  if (!share) throw Errors.notFound('Share link')
  return json({ share: toShareDTO(share) })
})

// DELETE → { share: null }: turns the link off (anyone holding it sees "no longer active").
export const DELETE = withRoute<P>(async ({ params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const article = await getArticle(client.id, params.articleId)
  await revokeShare(client.id, article.id, user.id)
  return json({ share: null })
})
