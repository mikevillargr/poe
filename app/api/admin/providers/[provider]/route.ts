import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { removeProviderKey, saveProviderKey } from '@/lib/admin/ai-settings'

export const dynamic = 'force-dynamic'

const providerSchema = z.enum(['anthropic', 'openai', 'moonshot'])
const keySchema = z.object({
  apiKey: z.string().trim().min(8, 'That doesn’t look like an API key.').max(500),
  baseUrl: z.string().trim().url().max(200).nullable().optional(),
})

// PUT { apiKey, baseUrl? } → { provider: status } (key encrypted at rest, never echoed)
export const PUT = withRoute<{ provider: string }>(
  async ({ req, params, user }) => {
    const provider = providerSchema.parse(params.provider)
    const { apiKey, baseUrl } = keySchema.parse(await req.json())
    return json({ provider: await saveProviderKey(provider, apiKey, baseUrl ?? null, user) })
  },
  { admin: true },
)

// DELETE → { provider: status } (falls back to the server env key if one exists)
export const DELETE = withRoute<{ provider: string }>(
  async ({ params }) => json({ provider: await removeProviderKey(providerSchema.parse(params.provider)) }),
  { admin: true },
)
