import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { listSheetSources } from '@/lib/templates/inputs'

export const dynamic = 'force-dynamic'

// GET → { sources: [{ id, name, spreadsheetId, tab, target, templateId, inventoryId, lastSyncedAt, lastSyncResult }] }
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json({ sources: await listSheetSources(client.id) })
})
