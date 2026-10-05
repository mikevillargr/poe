import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { currentRoles, modelOptions, saveRole } from '@/lib/admin/ai-settings'
import { PROVIDER_LABELS } from '@/lib/ai/types'

export const dynamic = 'force-dynamic'

const roleSetting = z.object({
  provider: z.enum(['anthropic', 'openai', 'moonshot']),
  modelId: z.string().trim().min(1).max(200),
  params: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().min(256).max(64000).optional(),
      maxSearches: z.number().int().min(1).max(20).optional(),
    })
    .default({}),
})
const bodySchema = z.object({ generation: roleSetting.optional(), research: roleSetting.optional() })

// GET → { roles: { generation?, research? }, options: { [provider]: { configured, models[], warning? } } }
export const GET = withRoute(async () => {
  const [roles, options] = await Promise.all([currentRoles(), modelOptions()])
  return json({ roles, options })
}, { admin: true })

// PUT { generation?, research? } → { roles }. Provider must be configured; research models must support web search.
export const PUT = withRoute(async ({ req, user }) => {
  const body = bodySchema.parse(await req.json())
  const options = await modelOptions()
  for (const role of ['generation', 'research'] as const) {
    const s = body[role]
    if (!s) continue
    const opt = options[s.provider]
    if (!opt.configured) throw Errors.badRequest(`Add a ${PROVIDER_LABELS[s.provider]} key before choosing its models.`)
    const model = opt.models.find((m) => m.id === s.modelId)
    if (!model) throw Errors.badRequest(`“${s.modelId}” isn’t an available ${PROVIDER_LABELS[s.provider]} model.`)
    if (role === 'research' && !model.supportsWebSearch) {
      throw Errors.badRequest(`“${model.label}” can’t search the web, so it can’t be the research model.`)
    }
  }
  for (const role of ['generation', 'research'] as const) {
    const s = body[role]
    if (s) await saveRole(role, s, user)
  }
  return json({ roles: await currentRoles() })
}, { admin: true })
