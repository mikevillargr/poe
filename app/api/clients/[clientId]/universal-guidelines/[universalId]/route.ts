import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { setUniversalForClient } from '@/lib/guidelines/repo'
import { Errors } from '@/lib/api/errors'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ on: z.boolean() })

// PUT { on } → { ok }. D-003: switch one Universal rule on or off for this client only.
export const PUT = withRoute<{ clientId: string; universalId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  if (!/^[0-9a-f-]{36}$/i.test(params.universalId)) throw Errors.notFound('Universal guideline')
  const { on } = bodySchema.parse(await req.json())
  await setUniversalForClient(client.id, params.universalId, on, user.id)
  return json({ ok: true })
})
