import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { restoreRevision } from '@/lib/templates/manage'

export const dynamic = 'force-dynamic'

// POST { revisionNo } → { revisionNo } (the restore is saved as a new revision)
export const POST = withRoute<{ clientId: string; templateId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { revisionNo } = z.object({ revisionNo: z.number().int().min(1) }).parse(await req.json())
  return json(await restoreRevision(client.id, params.templateId, revisionNo, user))
})
