import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { createGuideline, listGuidelines } from '@/lib/guidelines/repo'
import { guidelineInputSchema, toGuidelineDTO } from '@/lib/guidelines/schemas'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// GET → { guidelines: GuidelineDTO[] } (all categories, canonical order)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const rows = await listGuidelines(client.id)
  return json({ guidelines: rows.map(toGuidelineDTO) })
})

// POST { category, title?, rule, weight?, active? } → 201 { guideline }
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const input = guidelineInputSchema.parse(await req.json())
  const guideline = await createGuideline(client.id, input, user.id)
  return json({ guideline: toGuidelineDTO(guideline) }, { status: 201 })
})
