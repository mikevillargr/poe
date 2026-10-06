import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { getRevision } from '@/lib/templates/manage'

export const dynamic = 'force-dynamic'

// GET → { snapshot: { name, slug, kind, enabled, config } } (History diff)
export const GET = withRoute<{ clientId: string; templateId: string; revisionNo: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const n = Number(params.revisionNo)
  if (!Number.isInteger(n) || n < 1) throw Errors.notFound('Revision')
  return json({ snapshot: await getRevision(client.id, params.templateId, n) })
})
