import { withRoute, json } from '@/lib/auth/guards'
import { createUniversalGuideline, listUniversalGuidelines } from '@/lib/guidelines/repo'
import { guidelineInputSchema, toUniversalGuidelineDTO } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

// The agency Universal template that createClient() copies to every new client (super admin only).

// GET → { guidelines: GuidelineDTO[] }
export const GET = withRoute(
  async () => {
    const rows = await listUniversalGuidelines()
    return json({ guidelines: rows.map(toUniversalGuidelineDTO) })
  },
  { admin: true },
)

// POST { category, title?, rule, weight?, active? } → 201 { guideline }
export const POST = withRoute(
  async ({ req, user }) => {
    const input = guidelineInputSchema.parse(await req.json())
    const guideline = await createUniversalGuideline(input, user.id)
    return json({ guideline: toUniversalGuidelineDTO(guideline) }, { status: 201 })
  },
  { admin: true },
)
