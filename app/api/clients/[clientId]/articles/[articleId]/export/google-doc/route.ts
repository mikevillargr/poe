import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticle } from '@/lib/articles/repo'
import { buildExportDocument } from '@/lib/export/document'
import { createGoogleDoc } from '@/lib/google/drive'

export const dynamic = 'force-dynamic'

// The editor sends its current HTML so unsaved edits are included.
const bodySchema = z.object({ html: z.string().max(3_000_000) })

// POST { html } → { url }. DR-014: creates a Google Doc in the signed-in person's My Drive, using their own
// connected Drive permission. 409 DRIVE_NOT_CONNECTED when they haven't connected (or Google revoked it).
export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId)
  const article = await getArticle(client.id, params.articleId)
  const { html } = bodySchema.parse(await req.json())
  const title = article.title || 'Article'
  const url = await createGoogleDoc(user.id, title, buildExportDocument(title, html))
  return json({ url })
})
