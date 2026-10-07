import { withRoute, json } from '@/lib/auth/guards'
import { typicalDurationMs } from '@/lib/ai/estimates'

export const dynamic = 'force-dynamic'

// GET → { research: ms | null, generation: ms | null }. DR-016: typical run time of the currently configured
// models (median of their last 20 calls; null with fewer than 3).
export const GET = withRoute(async () => {
  const [research, generation] = await Promise.all([typicalDurationMs('research'), typicalDurationMs('generation')])
  return json({ research, generation })
})
