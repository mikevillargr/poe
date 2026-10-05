import type { ModelInfo, ProviderId } from '../types'

// Fallback model lists and capability data, used when a provider's live /models call fails and to
// annotate live results (live lists don't say which models support web search).
// WS-ai owns this file. Every entry was checked against the provider's docs on 2026-10-05; the
// source is cited above each list. Re-verify when providers ship new models.

type Curated = Omit<ModelInfo, 'source' | 'provider'>

export const CURATED_MODELS: Record<ProviderId, Curated[]> = {
  // Source: platform.claude.com/docs/en/models/overview ("Claude API ID" + "Context window" rows)
  // and …/agents-and-tools/tool-use/web-search-tool. Fable 5.1 / Opus 5.5 / Sonnet 5.5: 1M context;
  // Haiku 4.5: 200K (retirement "not sooner than October 15, 2026"). All support the web_search
  // server tool (Haiku 4.5 on the basic web_search_20250305 version; see anthropic-map.ts).
  anthropic: [
    { id: 'claude-fable-5-1', label: 'Claude Fable 5.1', contextWindow: 1_000_000, supportsWebSearch: true },
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', contextWindow: 1_000_000, supportsWebSearch: true },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', contextWindow: 1_000_000, supportsWebSearch: true },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', contextWindow: 200_000, supportsWebSearch: true },
  ],
  // Source: developers.openai.com/api/docs/models (flagship list) and the per-model pages
  // (…/models/gpt-6-astra, …/gpt-6.1-sol, …/gpt-6-luna: 1,050,000 context, Responses API supported,
  // web_search listed under supported tools). gpt-5.5 / gpt-4.1 / gpt-4.1-mini are named as
  // web_search-capable in …/guides/tools-web-search; their context windows aren't restated here.
  openai: [
    { id: 'gpt-6-astra', label: 'GPT-6 Astra', contextWindow: 1_050_000, supportsWebSearch: true },
    { id: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', contextWindow: 1_050_000, supportsWebSearch: true },
    { id: 'gpt-6-luna', label: 'GPT-6 Luna', contextWindow: 1_050_000, supportsWebSearch: true },
    { id: 'gpt-5.5', label: 'GPT-5.5', supportsWebSearch: true },
    { id: 'gpt-4.1', label: 'GPT-4.1', supportsWebSearch: true },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', supportsWebSearch: true },
  ],
  // Source: platform.kimi.ai/docs/models + …/docs/api/models-overview (kimi-k3 1M, kimi-k2.6 256K,
  // kimi-k2.7-code 256K) and …/docs/guide/use-web-search ("kimi-k3 always reasons, and kimi-k2.6 can
  // also perform web search with thinking enabled"). kimi-k2.7-code is a coding model and isn't
  // listed for web search, so it's generation-only here.
  moonshot: [
    { id: 'kimi-k3', label: 'Kimi K3', contextWindow: 1_000_000, supportsWebSearch: true },
    { id: 'kimi-k2.6', label: 'Kimi K2.6', contextWindow: 256_000, supportsWebSearch: true },
    { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', contextWindow: 256_000, supportsWebSearch: false },
  ],
}

/**
 * Deprecated IDs that may still come back from a live /models call. Sources: the "Deprecated"
 * section of developers.openai.com/api/docs/models/all; platform.kimi.ai/docs/models (kimi-k2.5 and
 * moonshot-v1-* discontinued 2026-08-31, kimi-k2 series 2026-05-25, kimi-latest 2026-01-28).
 */
export const DEPRECATED_MODELS: Record<ProviderId, RegExp[]> = {
  anthropic: [],
  openai: [
    /^gpt-5\.4-nano/,
    /^gpt-5\.3-codex/,
    /^gpt-5\.1(?![\d])/,
    /^gpt-5\.[23]-chat/,
    /^gpt-5\.2-codex/,
    /^o3-mini/,
    /^o1(?:$|-)/,
    /^gpt-4\.1-nano/,
    /^o4-mini/,
    /^gpt-4\.5-preview/,
    /^gpt-4-turbo/,
    /^gpt-3\.5-turbo/,
    /^gpt-4(?:$|-\d{4})/,
  ],
  moonshot: [/^kimi-k2\.5/, /^moonshot-v1/, /^kimi-k2(?:$|-)/, /^kimi-latest/],
}

export function curatedModels(provider: ProviderId): ModelInfo[] {
  return CURATED_MODELS[provider].map((m) => ({ ...m, provider, source: 'curated' as const }))
}
