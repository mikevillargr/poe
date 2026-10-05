import { withRoute, json } from '@/lib/auth/guards'
import { providerStatuses } from '@/lib/admin/ai-settings'

export const dynamic = 'force-dynamic'

// GET → { providers: [{ provider, configured, source: 'db'|'env'|null, last4, baseUrl }] }. Never returns keys.
export const GET = withRoute(async () => json({ providers: await providerStatuses() }), { admin: true })
