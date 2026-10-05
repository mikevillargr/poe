import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { testProvider } from '@/lib/admin/ai-settings'

export const dynamic = 'force-dynamic'

// POST → { ok, message } using the currently stored (or env) key.
export const POST = withRoute<{ provider: string }>(
  async ({ params }) => json(await testProvider(z.enum(['anthropic', 'openai', 'moonshot']).parse(params.provider))),
  { admin: true },
)
