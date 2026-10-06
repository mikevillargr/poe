import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { listInventories } from '@/lib/templates/inputs'

export const dynamic = 'force-dynamic'

// GET → { inventories: [{ slug, name, kind, source, lastSyncedAt, items }] } (D-002 link inventories)
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json({ inventories: await listInventories(client.id) })
})
