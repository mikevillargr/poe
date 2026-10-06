import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { inventoryItems } from '@/lib/templates/repo'

export const dynamic = 'force-dynamic'

// GET → { items: [{ url, title, attrs }] } (first 500)
export const GET = withRoute<{ clientId: string; slug: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const items = await inventoryItems(client.id, params.slug)
  return json({ items: items.slice(0, 500), total: items.length })
})
