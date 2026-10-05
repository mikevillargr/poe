import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { recentEvents } from '@/lib/articles/repo'

export const dynamic = 'force-dynamic'

// GET ?limit= → { events: ArticleEventDTO[] } (client home activity feed)
export const GET = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId)
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20
  return json({ events: await recentEvents(client.id, limit) })
})
