import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { deleteGuideline, updateGuideline } from '@/lib/guidelines/repo'
import { guidelineUpdateSchema, toGuidelineDTO } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string; guidelineId: string }

// PATCH (any subset of guidelineUpdateSchema) → { guideline }. Toggling active is a PATCH too.
export const PATCH = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const patch = guidelineUpdateSchema.parse(await req.json())
  const guideline = await updateGuideline(client.id, params.guidelineId, patch, user.id)
  return json({ guideline: toGuidelineDTO(guideline) })
})

export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  await deleteGuideline(client.id, params.guidelineId)
  return json({ ok: true })
})
