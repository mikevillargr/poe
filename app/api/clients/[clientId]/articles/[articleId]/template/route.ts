import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { setArticleTemplate } from '@/lib/templates/repo'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string }

const bodySchema = z.object({
  templateId: z.string().uuid().nullable(),
  /** Per-row template inputs, e.g. { itemUrl } or { label, pageUrl }; ctaIndex is assigned when omitted. */
  inputs: z
    .record(z.string().max(60), z.union([z.string().max(5000), z.number(), z.null()]))
    .refine((r) => Object.keys(r).length <= 40, 'Too many inputs')
    .default({}),
})

// PUT { templateId | null, inputs? } → { article: { id, templateId, templateInputs } } (D-002)
export const PUT = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  await getArticle(client.id, params.articleId)
  const body = bodySchema.parse(await req.json())
  const article = await setArticleTemplate(client.id, params.articleId, body.templateId, body.inputs, user)
  return json({ article })
})
