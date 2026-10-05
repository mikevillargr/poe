// listModels() plumbing shared by the provider adapters: live list (cached 1 h) merged with curated
// capability data, falling back to the curated list when there's no key or the live call fails.
import type { ModelInfo, ProviderId } from '../types'
import { cachedModels, modelCacheKey } from './cache'
import { curatedModels } from './curated'
import { mergeModels, type LiveModel } from './merge'

export async function listModelsWithFallback(
  provider: ProviderId,
  creds: { apiKey: string; baseUrl?: string } | null,
  fetchLive: () => Promise<LiveModel[]>,
): Promise<ModelInfo[]> {
  if (!creds) return curatedModels(provider)
  try {
    return await cachedModels(modelCacheKey(provider, creds.apiKey, creds.baseUrl), async () => {
      const merged = mergeModels(provider, await fetchLive())
      if (!merged.length) throw new Error('live model list contained no usable text models')
      return merged
    })
  } catch (err) {
    // Never log the error object itself: SDK errors can carry request headers.
    const status = (err as { status?: unknown } | null)?.status
    console.warn(`[ai] ${provider} live model list unavailable${typeof status === 'number' ? ` (${status})` : ''}; using curated list`)
    return curatedModels(provider)
  }
}
