import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { listUniversalForClient } from '@/lib/guidelines/repo'
import { toUniversalGuidelineDTO } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

// GET → { guidelines: (GuidelineDTO & { onForClient })[] }. D-003: the Universal rules this client follows,
// with its own on/off switch for each. `active` is the rule's state on the Universal page.
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const rows = await listUniversalForClient(client.id)
  return json({ guidelines: rows.map((r) => ({ ...toUniversalGuidelineDTO(r), onForClient: r.onForClient })) })
})
