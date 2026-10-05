import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { aiModelRoles, aiProviderCredentials } from '@/lib/db/schema'
import { encryptSecret, getProviderStatus, DEFAULT_BASE_URLS } from '@/lib/ai/secrets'
import { getProvider, PROVIDERS } from '@/lib/ai/registry'
import { curatedModels } from '@/lib/ai/models/curated'
import { AIError, type ModelInfo, type ModelRole, type ProviderId } from '@/lib/ai/types'
import type { AppUser } from '@/lib/auth/guards'

export type ProviderStatusDTO = Awaited<ReturnType<typeof getProviderStatus>>

export async function providerStatuses(): Promise<ProviderStatusDTO[]> {
  return Promise.all(PROVIDERS.map((p) => getProviderStatus(p)))
}

/** Encrypts and stores a key (never returned). An empty baseUrl means the provider default. */
export async function saveProviderKey(provider: ProviderId, apiKey: string, baseUrl: string | null, user: AppUser) {
  const enc = encryptSecret(apiKey.trim())
  const values = {
    provider,
    ...enc,
    baseUrl: baseUrl || DEFAULT_BASE_URLS[provider] || null,
    enabled: true,
    updatedBy: user.id,
    updatedAt: new Date(),
  }
  await db.insert(aiProviderCredentials).values(values).onConflictDoUpdate({ target: aiProviderCredentials.provider, set: values })
  return getProviderStatus(provider)
}

export async function removeProviderKey(provider: ProviderId) {
  await db.delete(aiProviderCredentials).where(eq(aiProviderCredentials.provider, provider))
  return getProviderStatus(provider)
}

export async function testProvider(provider: ProviderId): Promise<{ ok: boolean; message: string }> {
  try {
    const p = await getProvider(provider)
    const r = await p.testKey()
    return { ok: r.ok, message: r.message ?? (r.ok ? 'Key works.' : 'Key was rejected.') }
  } catch (err) {
    if (err instanceof AIError) {
      const messages: Partial<Record<AIError['code'], string>> = {
        PROVIDER_NOT_CONFIGURED: 'No key is set for this provider.',
        PROVIDER_NOT_IMPLEMENTED: 'This provider isn’t connected in this build yet.',
        INVALID_API_KEY: 'The provider rejected this key.',
        RATE_LIMITED: 'The provider is rate-limiting requests. Try again shortly.',
      }
      return { ok: false, message: messages[err.code] ?? err.message }
    }
    return { ok: false, message: err instanceof Error ? err.message : 'Test failed.' }
  }
}

/** Models per configured provider: live list when the adapter can fetch it, else the curated fallback. */
export async function modelOptions(): Promise<Record<ProviderId, { configured: boolean; models: ModelInfo[]; warning?: string }>> {
  const statuses = await providerStatuses()
  const entries = await Promise.all(
    PROVIDERS.map(async (provider) => {
      const configured = statuses.find((s) => s.provider === provider)?.configured ?? false
      if (!configured) return [provider, { configured, models: curatedModels(provider) }] as const
      try {
        const models = await (await getProvider(provider)).listModels()
        return [provider, { configured, models: models.length ? models : curatedModels(provider) }] as const
      } catch (err) {
        return [
          provider,
          {
            configured,
            models: curatedModels(provider),
            warning: err instanceof Error ? `Showing the built-in list: ${err.message}` : 'Showing the built-in list.',
          },
        ] as const
      }
    }),
  )
  return Object.fromEntries(entries) as Record<ProviderId, { configured: boolean; models: ModelInfo[]; warning?: string }>
}

export interface RoleSetting {
  provider: ProviderId
  modelId: string
  params: { temperature?: number; maxTokens?: number; maxSearches?: number }
}

export async function currentRoles(): Promise<Partial<Record<ModelRole, RoleSetting>>> {
  const rows = await db.select().from(aiModelRoles)
  return Object.fromEntries(rows.map((r) => [r.role, { provider: r.provider, modelId: r.modelId, params: r.params ?? {} }]))
}

export async function saveRole(role: ModelRole, setting: RoleSetting, user: AppUser) {
  const values = { role, provider: setting.provider, modelId: setting.modelId, params: setting.params, updatedBy: user.id, updatedAt: new Date() }
  await db.insert(aiModelRoles).values(values).onConflictDoUpdate({ target: aiModelRoles.role, set: values })
}
