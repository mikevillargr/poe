// In-process cache for live model lists (1 hour). Keyed by provider + a short hash of the API key,
// so rotating a key in Settings never serves the previous key's list. Failures are not cached.
import { createHash } from 'node:crypto'
import type { ModelInfo, ProviderId } from '../types'

export const MODEL_CACHE_TTL_MS = 60 * 60 * 1000

interface Entry {
  at: number
  models: ModelInfo[]
}

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<ModelInfo[]>>()

export function modelCacheKey(provider: ProviderId, apiKey: string, baseUrl?: string): string {
  const fp = createHash('sha256').update(`${apiKey}\n${baseUrl ?? ''}`).digest('hex').slice(0, 16)
  return `${provider}:${fp}`
}

/** Returns the cached list if fresh; otherwise runs `load` once (concurrent callers share it). */
export async function cachedModels(key: string, load: () => Promise<ModelInfo[]>, now = Date.now()): Promise<ModelInfo[]> {
  const hit = cache.get(key)
  if (hit && now - hit.at < MODEL_CACHE_TTL_MS) return hit.models
  const pending = inflight.get(key)
  if (pending) return pending
  const p = load()
    .then((models) => {
      cache.set(key, { at: now, models })
      return models
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function clearModelCache(provider?: ProviderId) {
  for (const k of [...cache.keys()]) if (!provider || k.startsWith(`${provider}:`)) cache.delete(k)
}
