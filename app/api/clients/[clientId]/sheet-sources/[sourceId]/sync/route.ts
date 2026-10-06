import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { syncSheetSource } from '@/lib/templates/inputs'
import { sheetsApiError } from '@/lib/templates/http'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const bodySchema = z.object({
  fromRow: z.number().int().positive().optional(),
  toRow: z.number().int().positive().optional(),
  dryRun: z.boolean().optional(),
})

// POST { fromRow?, toRow?, dryRun? } → sync result. Topic sources queue new rows (fromRow is required on
// the first sync); inventory sources replace the inventory's links (D-002).
export const POST = withRoute<{ clientId: string; sourceId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  if (!/^[0-9a-f-]{36}$/i.test(params.sourceId)) throw Errors.notFound('Sheet source')
  const body = bodySchema.parse(await req.json().catch(() => ({})))
  try {
    return json(await syncSheetSource(client.id, params.sourceId, user, body))
  } catch (err) {
    sheetsApiError(err)
  }
})
