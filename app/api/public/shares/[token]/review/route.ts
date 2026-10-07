import { z } from 'zod'
import { json } from '@/lib/auth/guards'
import { publicRoute } from '@/lib/api/public'
import { latestDecision, recordDecision } from '@/lib/comments/repo'
import { guestNameSchema, rateLimit, requireShare } from '@/lib/shares/guest'

export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested']),
    name: guestNameSchema,
    note: z.string().trim().max(2000).optional(),
  })
  .refine((b) => b.decision === 'approved' || !!b.note, { message: 'Tell the team what to change', path: ['note'] })

// POST { decision, name, note? } → { decision } (DR-021: recorded in History; the owner is notified; status unchanged)
export const POST = publicRoute<{ token: string }>(async ({ req, params }) => {
  const share = await requireShare(params.token)
  rateLimit(req, params.token, 'review', 6)
  const b = bodySchema.parse(await req.json())
  await recordDecision({ tenantId: share.tenantId, articleId: share.articleId, decision: b.decision, name: b.name, note: b.note || null })
  return json({ decision: await latestDecision(share.articleId) })
})
