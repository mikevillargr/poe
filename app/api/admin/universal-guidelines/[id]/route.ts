import { withRoute, json } from '@/lib/auth/guards'
import { deleteUniversalGuideline, updateUniversalGuideline } from '@/lib/guidelines/repo'
import { guidelineUpdateSchema, toUniversalGuidelineDTO } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

type P = { id: string }

// PATCH (any subset of guidelineUpdateSchema) → { guideline }
export const PATCH = withRoute<P>(
  async ({ req, params, user }) => {
    const patch = guidelineUpdateSchema.parse(await req.json())
    const guideline = await updateUniversalGuideline(params.id, patch, user.id)
    return json({ guideline: toUniversalGuidelineDTO(guideline) })
  },
  { admin: true },
)

export const DELETE = withRoute<P>(
  async ({ params }) => {
    await deleteUniversalGuideline(params.id)
    return json({ ok: true })
  },
  { admin: true },
)
