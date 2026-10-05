import type { ModelInfo, ProviderId } from '../types'

// Fallback model lists and capability data, used when a provider's live /models call fails and to
// annotate live results (live lists don't say which models support web search).
// WS-ai owns this file: verify every entry against current provider docs.

type Curated = Omit<ModelInfo, 'source' | 'provider'>

export const CURATED_MODELS: Record<ProviderId, Curated[]> = {
  anthropic: [
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', supportsWebSearch: true },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', supportsWebSearch: true },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', supportsWebSearch: true },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', supportsWebSearch: true },
  ],
  // TODO(WS-ai): fill from https://platform.openai.com/docs/models (web_search via Responses API).
  openai: [],
  // TODO(WS-ai): fill from https://platform.moonshot.ai/docs ($web_search builtin tool).
  moonshot: [],
}

export function curatedModels(provider: ProviderId): ModelInfo[] {
  return CURATED_MODELS[provider].map((m) => ({ ...m, provider, source: 'curated' as const }))
}
