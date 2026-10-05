// AI provider contract. FROZEN after foundation: change only via INITIATIVE §7.
// Shared types only (safe to import from client code); implementations live in lib/ai/providers.

export type ProviderId = 'anthropic' | 'openai' | 'moonshot'
export type ModelRole = 'generation' | 'research'

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'OpenAI',
  moonshot: 'Kimi (Moonshot)',
}

export const ROLE_LABELS: Record<ModelRole, string> = {
  generation: 'Text generation',
  research: 'Research (web search)',
}

export interface ModelInfo {
  provider: ProviderId
  id: string
  label: string
  contextWindow?: number
  supportsWebSearch: boolean
  deprecated?: boolean
  /** 'live' = returned by the provider's models endpoint; 'curated' = from our fallback list. */
  source: 'live' | 'curated'
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateParams {
  system?: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

export interface ResearchParams extends GenerateParams {
  /** Upper bound on web searches the model may run. */
  maxSearches?: number
}

export interface Citation {
  id: string
  url: string
  title?: string
  snippet?: string
}

export interface Usage {
  inputTokens: number
  outputTokens: number
}

export type AIStreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'search'; query: string }
  | { type: 'citation'; citation: Citation }
  | { type: 'usage'; usage: Usage }
  | { type: 'done'; text: string; citations?: Citation[] }
  | { type: 'error'; code: string; message: string }
  /** Emitted by route handlers (not providers) after results are persisted. */
  | { type: 'saved'; articleId: string; versionNo?: number }

export interface AIProvider {
  id: ProviderId
  /** Live list from the provider, merged with curated capability data; falls back to curated. */
  listModels(): Promise<ModelInfo[]>
  streamText(model: string, params: GenerateParams): AsyncIterable<AIStreamEvent>
  generateText(model: string, params: GenerateParams): Promise<{ text: string; usage?: Usage }>
  /** Web-search-grounded generation. Must emit `citation` events and end with `done` (citations included). */
  research(model: string, params: ResearchParams): AsyncIterable<AIStreamEvent>
  testKey(): Promise<{ ok: boolean; message?: string }>
}

export interface ResolvedRole {
  role: ModelRole
  provider: ProviderId
  modelId: string
  params: { temperature?: number; maxTokens?: number; maxSearches?: number }
}

export class AIError extends Error {
  constructor(
    public code:
      | 'PROVIDER_NOT_CONFIGURED'
      | 'PROVIDER_NOT_IMPLEMENTED'
      | 'WEB_SEARCH_UNSUPPORTED'
      | 'INVALID_API_KEY'
      | 'RATE_LIMITED'
      | 'PROVIDER_ERROR'
      | 'ROLE_NOT_CONFIGURED',
    message: string,
  ) {
    super(message)
  }
}
