// Merges a provider's live /models list with curated capability data. Pure (unit-tested).
import type { ModelInfo, ProviderId } from '../types'
import { CURATED_MODELS, DEPRECATED_MODELS } from './curated'

export interface LiveModel {
  id: string
  label?: string
  contextWindow?: number
}

/** Strips a trailing date snapshot (`-20251001`, `-2025-04-14`) so snapshots match their base ID. */
export function baseModelId(id: string): string {
  return id.replace(/-(?:\d{8}|\d{4}-\d{2}-\d{2})$/, '')
}

/**
 * Web search capability for IDs that aren't curated. Rules follow the docs cited in curated.ts:
 * - anthropic: every current Claude family supports the web_search server tool;
 * - openai: the gpt-6 family lists web_search on every model page; anything else must be curated;
 * - moonshot: $web_search is documented for kimi-k3 and kimi-k2.6 only.
 */
function ruleSupportsWebSearch(provider: ProviderId, id: string): boolean {
  if (provider === 'anthropic') return /^claude-(?:fable|mythos|opus|sonnet|haiku)-\d/.test(id)
  if (provider === 'openai') return /^gpt-6(?:[.-]|$)/.test(id)
  return /^kimi-(?:k3|k2\.6)(?:[.-]|$)/.test(id)
}

/** Is this a text / chat model we can drive? (Live lists also contain embeddings, audio, images…) */
export function isTextModel(provider: ProviderId, id: string): boolean {
  if (provider === 'anthropic') return id.startsWith('claude-')
  if (provider === 'moonshot') return /^(?:kimi|moonshot)-/.test(id) && !/vision|embedding/.test(id)
  if (!/^(?:gpt-|o\d|chatgpt-)/.test(id)) return false
  return !/(?:embedding|tts|transcribe|whisper|audio|realtime|image|dall-e|moderation|search-preview|-live|computer-use|cyber|daybreak|rosalind|instruct)/.test(
    id,
  )
}

export function findCurated(provider: ProviderId, id: string) {
  const list = CURATED_MODELS[provider]
  return list.find((c) => c.id === id) ?? list.find((c) => baseModelId(c.id) === baseModelId(id))
}

export function supportsWebSearch(provider: ProviderId, id: string): boolean {
  const curated = findCurated(provider, id)
  return curated ? curated.supportsWebSearch : ruleSupportsWebSearch(provider, id)
}

export function isDeprecated(provider: ProviderId, id: string): boolean {
  return DEPRECATED_MODELS[provider].some((re) => re.test(id))
}

/**
 * Live entries win on existence, label and context window; curated data wins on capabilities.
 * Order: curated models (in curated order) that are live, then other live text models in the
 * provider's order, deprecated ones last.
 */
export function mergeModels(provider: ProviderId, live: LiveModel[]): ModelInfo[] {
  const curated = CURATED_MODELS[provider]
  const seen = new Set<string>()
  const rows: { info: ModelInfo; rank: number }[] = []

  live.forEach((m, i) => {
    if (!m.id || seen.has(m.id) || !isTextModel(provider, m.id)) return
    seen.add(m.id)
    const c = findCurated(provider, m.id)
    const curatedIndex = c ? curated.indexOf(c) : -1
    const deprecated = isDeprecated(provider, m.id)
    const info: ModelInfo = {
      provider,
      id: m.id,
      label: m.label?.trim() || c?.label || m.id,
      supportsWebSearch: c ? c.supportsWebSearch : ruleSupportsWebSearch(provider, m.id),
      source: 'live',
    }
    const ctx = m.contextWindow ?? c?.contextWindow
    if (ctx) info.contextWindow = ctx
    if (deprecated) info.deprecated = true
    // Exact curated IDs first; dated snapshots of a curated base right after; deprecated last.
    const rank = deprecated ? 1e6 + i : curatedIndex >= 0 ? curatedIndex * 2 + (c!.id === m.id ? 0 : 1) : 1e3 + i
    rows.push({ info, rank })
  })

  return rows.sort((a, b) => a.rank - b.rank).map((r) => r.info)
}
