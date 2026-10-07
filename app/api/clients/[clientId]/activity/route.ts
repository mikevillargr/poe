import { withRoute, json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { recentEvents } from '@/lib/articles/repo'

export const dynamic = 'force-dynamic'

// GET ?limit=&before=<eventId> → { events: ArticleEventDTO[], nextCursor: string | null }
// (client home activity feed; `before` pages backwards through older events)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const GET = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId)
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20) || 20
  const before = req.nextUrl.searchParams.get('before') ?? undefined
  if (before && !UUID_RE.test(before)) throw Errors.badRequest('Invalid before cursor')
  return json(await recentEvents(client.id, limit, before))
})
