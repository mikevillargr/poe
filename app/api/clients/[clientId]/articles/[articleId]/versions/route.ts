import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { listVersions, saveManualVersion } from '@/lib/pipeline/versions'
import { createVersionSchema } from '@/lib/pipeline/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string; articleId: string }

// GET → { versions: ArticleVersionDTO[] } newest first (no HTML bodies).
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const article = await getArticle(client.id, params.articleId)
  return json({ versions: await listVersions(article.id) })
})

// POST { label? } → { version } : a manual snapshot of the current draftHtml.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { label } = createVersionSchema.parse(await req.json().catch(() => ({})))
  const version = await saveManualVersion(client.id, params.articleId, user, label)
  return json({ version }, { status: 201 })
})
