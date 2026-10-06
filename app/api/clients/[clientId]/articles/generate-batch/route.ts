import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { batchStatus, startBatch } from '@/lib/templates/batch'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type P = { clientId: string }

const bodySchema = z.object({ articleIds: z.array(z.string().uuid()).max(500).optional() })

// POST { articleIds? } → { queued, skipped[], alreadyRunning } — generates the client's queued templated
// articles, two at a time (D-002). GET → { batch: status | null }.
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = bodySchema.parse(await req.json().catch(() => ({})))
  const result = await startBatch(client, user, body.articleIds)
  return json(result, { status: result.alreadyRunning ? 409 : 202 })
})

export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json({ batch: batchStatus(client.id) })
})
