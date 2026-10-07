import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { getBranding, saveBranding } from '@/lib/branding'

export const dynamic = 'force-dynamic'

const bodySchema = z
  .object({
    agencyName: z.string().trim().min(1).max(80),
    website: z.union([z.literal(''), z.string().trim().url().max(300)]),
    about: z.string().trim().min(1).max(1200),
  })
  .partial()

// GET → Branding (DR-021: shared article pages).
export const GET = withRoute(async () => json(await getBranding()), { admin: true })

// PUT { agencyName?, website?, about? } → Branding
export const PUT = withRoute(async ({ req, user }) => json(await saveBranding(bodySchema.parse(await req.json()), user.id)), { admin: true })
