import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { markChecksReviewed } from '@/lib/templates/repo'

export const dynamic = 'force-dynamic'

// POST → { generationMeta } — clears "needs review" on a templated draft (DR-012 "Mark checks reviewed").
export const POST = withRoute<{ clientId: string; articleId: string }>(async ({ params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  return json({ generationMeta: await markChecksReviewed(client.id, params.articleId, user) })
})
