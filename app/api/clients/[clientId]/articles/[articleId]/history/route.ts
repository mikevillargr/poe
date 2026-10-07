import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { getArticleHistory } from '@/lib/articles/history'

export const dynamic = 'force-dynamic'

// GET → HistoryData: the article's activity, newest first, plus names and its origin (DR-020).
export const GET = withRoute<{ clientId: string; articleId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json(await getArticleHistory(client.id, params.articleId))
})
