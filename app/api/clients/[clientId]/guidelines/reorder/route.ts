import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { reorderGuidelines } from '@/lib/guidelines/repo'
import { reorderSchema } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// POST { category, orderedIds } → { ok: true }. Reorder is within one category only (DR-006).
export const POST = withRoute<P>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { category, orderedIds } = reorderSchema.parse(await req.json())
  await reorderGuidelines(client.id, category, orderedIds)
  return json({ ok: true })
})
