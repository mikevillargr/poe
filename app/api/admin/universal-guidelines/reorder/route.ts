import { withRoute, json } from '@/lib/auth/guards'
import { reorderUniversalGuidelines } from '@/lib/guidelines/repo'
import { reorderSchema } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

// POST { category, orderedIds } → { ok: true }. Reorder is within one category only (DR-006).
export const POST = withRoute(
  async ({ req }) => {
    const { category, orderedIds } = reorderSchema.parse(await req.json())
    await reorderUniversalGuidelines(category, orderedIds)
    return json({ ok: true })
  },
  { admin: true },
)
