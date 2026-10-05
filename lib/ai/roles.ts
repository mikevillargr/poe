import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiModelRoles, aiUsage } from '@/lib/db/schema'
import { getProvider, isMockMode, PROVIDERS } from './registry'
import {
  AIError,
  type AIStreamEvent,
  type GenerateParams,
  type ModelRole,
  type ProviderId,
  type ResearchParams,
  type ResolvedRole,
  type Usage,
} from './types'

export interface AICallContext {
  tenantId?: string | null
  articleId?: string | null
  userId?: string | null
}

// Which model does each role use? Settings (ai_model_roles) → env AI_DEFAULT_<ROLE>="provider:model"
// → mock in AI_MOCK mode → error.
export async function resolveRole(role: ModelRole): Promise<ResolvedRole> {
  const [row] = await db.select().from(aiModelRoles).where(eq(aiModelRoles.role, role)).limit(1)
  if (row) return { role, provider: row.provider, modelId: row.modelId, params: row.params ?? {} }

  const env = process.env[`AI_DEFAULT_${role.toUpperCase()}`]
  if (env?.includes(':')) {
    const [provider, ...rest] = env.split(':')
    if ((PROVIDERS as string[]).includes(provider)) {
      return { role, provider: provider as ProviderId, modelId: rest.join(':'), params: {} }
    }
  }
  if (isMockMode()) return { role, provider: 'anthropic', modelId: 'mock-anthropic', params: {} }
  throw new AIError('ROLE_NOT_CONFIGURED', `No model is configured for ${role}. Set it in Settings.`)
}

async function logUsage(resolved: ResolvedRole, usage: Usage, ctx: AICallContext) {
  try {
    await db.insert(aiUsage).values({
      role: resolved.role,
      provider: resolved.provider,
      model: resolved.modelId,
      tenantId: ctx.tenantId ?? null,
      articleId: ctx.articleId ?? null,
      userId: ctx.userId ?? null,
      inputTokens: Math.round(usage.inputTokens),
      outputTokens: Math.round(usage.outputTokens),
    })
  } catch (err) {
    console.error('ai_usage insert failed', err)
  }
}

async function* withUsage(
  resolved: ResolvedRole,
  source: AsyncIterable<AIStreamEvent>,
  ctx: AICallContext,
): AsyncGenerator<AIStreamEvent> {
  for await (const ev of source) {
    if (ev.type === 'usage') await logUsage(resolved, ev.usage, ctx)
    yield ev
  }
}

function withDefaults<T extends GenerateParams>(resolved: ResolvedRole, params: T): T {
  return {
    ...params,
    temperature: params.temperature ?? resolved.params.temperature,
    maxTokens: params.maxTokens ?? resolved.params.maxTokens,
  }
}

/** Streams text from the model configured for `role` (normally 'generation'). */
export async function streamForRole(role: ModelRole, params: GenerateParams, ctx: AICallContext = {}) {
  const resolved = await resolveRole(role)
  const provider = await getProvider(resolved.provider)
  return { resolved, events: withUsage(resolved, provider.streamText(resolved.modelId, withDefaults(resolved, params)), ctx) }
}

/** Web-search research with the model configured for the 'research' role. */
export async function researchForRole(params: ResearchParams, ctx: AICallContext = {}) {
  const resolved = await resolveRole('research')
  const provider = await getProvider(resolved.provider)
  const p = { ...withDefaults(resolved, params), maxSearches: params.maxSearches ?? resolved.params.maxSearches }
  return { resolved, events: withUsage(resolved, provider.research(resolved.modelId, p), ctx) }
}

/** Non-streaming call (extraction, optimize checks, recompose). */
export async function generateForRole(role: ModelRole, params: GenerateParams, ctx: AICallContext = {}) {
  const resolved = await resolveRole(role)
  const provider = await getProvider(resolved.provider)
  const result = await provider.generateText(resolved.modelId, withDefaults(resolved, params))
  if (result.usage) await logUsage(resolved, result.usage, ctx)
  return { resolved, ...result }
}

export function modelRef(r: ResolvedRole) {
  return `${r.provider}:${r.modelId}`
}
