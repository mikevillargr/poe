import { withRoute, json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { getDraftSessionChanges } from '@/lib/articles/history'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// GET ?event=<draft_edited event id> → { hunks: DraftHunk[], endsAt } (DR-020 "Show changes").
export const GET = withRoute<{ clientId: string; articleId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId)
  const event = req.nextUrl.searchParams.get('event') ?? ''
  if (!UUID_RE.test(event)) throw Errors.badRequest('Invalid event id')
  return json(await getDraftSessionChanges(client.id, params.articleId, event))
})
