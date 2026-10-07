import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type {
  BetaMessage,
  BetaMessageParam,
  BetaToolUnion,
  MessageCreateParamsStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { AIError, type AIProvider, type AIStreamEvent, type GenerateParams, type ResearchParams, type Usage } from '../types'
import { listModelsWithFallback } from '../models/list'
import { supportsWebSearch } from '../models/merge'
import {
  acceptsSampling,
  AnthropicStreamMapper,
  isModernClaude,
  SERVER_FALLBACK_BETA,
  usesServerFallback,
  webSearchToolType,
} from './anthropic-map'
import { mapProviderError, reasoningFloor, throwIfAborted, type CredentialsLoader, type ProviderOptions } from './shared'

// Anthropic (Claude) adapter: Messages API with streaming, web search server tool for research.
// Uses the beta namespace only so server-side refusal fallbacks can be enabled per model.

const DEFAULT_MAX_TOKENS = 16000
const MAX_PAUSE_CONTINUATIONS = 5

export function createAnthropicProvider(loadCredentials: CredentialsLoader, opts: ProviderOptions = {}): AIProvider {
  let clientPromise: Promise<Anthropic> | null = null
  const client = () =>
    (clientPromise ??= loadCredentials().then(
      (c) => new Anthropic({ apiKey: c.apiKey, ...(c.baseUrl ? { baseURL: c.baseUrl } : {}), maxRetries: 2, ...(opts.fetch ? { fetch: opts.fetch } : {}) }),
    ))

  /** `think`: DR-016 visible thinking, only for the streamed research and drafts (not background calls). */
  function baseParams(model: string, p: GenerateParams, think = false): MessageCreateParamsStreaming {
    const maxTokens = isModernClaude(model)
      ? reasoningFloor(p.maxTokens, DEFAULT_MAX_TOKENS)
      : (p.maxTokens ?? DEFAULT_MAX_TOKENS)
    return {
      model,
      max_tokens: maxTokens,
      stream: true,
      ...(p.system ? { system: p.system } : {}),
      messages: p.messages.map((m): BetaMessageParam => ({ role: m.role, content: m.content })),
      ...(p.temperature !== undefined && acceptsSampling(model) ? { temperature: p.temperature } : {}),
      ...(usesServerFallback(model) ? { betas: [SERVER_FALLBACK_BETA], fallbacks: 'default' as const } : {}),
      // DR-016: adaptive thinking with a readable summary, shown as the live "thinking" peek.
      ...(think && isModernClaude(model) ? { thinking: { type: 'adaptive' as const, display: 'summarized' as const } } : {}),
    }
  }

  /** One logical turn, resuming `pause_turn` (server tool loop limit) up to MAX_PAUSE_CONTINUATIONS. */
  async function* run(params: MessageCreateParamsStreaming, signal: AbortSignal | undefined, mapper: AnthropicStreamMapper) {
    const c = await client()
    const usage: Usage = { inputTokens: 0, outputTokens: 0 }
    let messages = params.messages
    let final: BetaMessage | null = null
    try {
      for (let attempt = 0; attempt <= MAX_PAUSE_CONTINUATIONS; attempt++) {
        throwIfAborted(signal)
        const { stream: _s, ...rest } = { ...params, messages }
        const stream = c.beta.messages.stream(rest, { signal })
        for await (const ev of stream) for (const out of mapper.handle(ev)) yield out
        final = await stream.finalMessage()
        for (const out of mapper.finalize(final.content)) yield out
        usage.inputTokens += final.usage.input_tokens + (final.usage.cache_read_input_tokens ?? 0) + (final.usage.cache_creation_input_tokens ?? 0)
        usage.outputTokens += final.usage.output_tokens
        if (final.stop_reason !== 'pause_turn') break
        // Resume: send the paused assistant turn back unchanged (no extra "continue" message).
        messages = [...messages, { role: 'assistant', content: final.content }]
      }
    } catch (err) {
      throw mapProviderError('anthropic', err, signal)
    }
    yield { type: 'usage', usage } satisfies AIStreamEvent
    if (final?.stop_reason === 'refusal') {
      const category = final.stop_details?.category
      throw new AIError('PROVIDER_ERROR', `Claude declined this request${category ? ` (${category})` : ''}.`)
    }
    if (final?.stop_reason === 'pause_turn') {
      throw new AIError('PROVIDER_ERROR', 'Claude paused the search loop too many times; try fewer searches.')
    }
  }

  return {
    id: 'anthropic',

    async listModels() {
      const creds = await loadCredentials().catch((err) => {
        if (err instanceof AIError && err.code === 'PROVIDER_NOT_CONFIGURED') return null
        throw err
      })
      return listModelsWithFallback('anthropic', creds, async () => {
        const c = await client()
        const out = []
        for await (const m of c.models.list({ limit: 100 })) {
          out.push({ id: m.id, label: m.display_name, contextWindow: m.max_input_tokens ?? undefined })
        }
        return out
      })
    },

    async *streamText(model, params) {
      const mapper = new AnthropicStreamMapper()
      yield* run(baseParams(model, params, true), params.signal, mapper)
      yield { type: 'done', text: mapper.text }
    },

    async generateText(model, params) {
      const mapper = new AnthropicStreamMapper()
      let usage: Usage | undefined
      for await (const ev of run(baseParams(model, params), params.signal, mapper)) {
        if (ev.type === 'usage') usage = ev.usage
      }
      return { text: mapper.text, usage }
    },

    async *research(model, params: ResearchParams) {
      if (!supportsWebSearch('anthropic', model)) {
        throw new AIError('WEB_SEARCH_UNSUPPORTED', `${model} can't run web search.`)
      }
      const tool = {
        type: webSearchToolType(model),
        name: 'web_search',
        ...(params.maxSearches ? { max_uses: params.maxSearches } : {}),
      } as BetaToolUnion
      const mapper = new AnthropicStreamMapper()
      yield* run({ ...baseParams(model, params, true), tools: [tool] }, params.signal, mapper)
      yield { type: 'done', text: mapper.text, citations: mapper.citationList() }
    },

    async testKey() {
      try {
        const c = await client()
        await c.models.list({ limit: 1 })
        return { ok: true, message: 'Anthropic key works.' }
      } catch (err) {
        return { ok: false, message: mapProviderError('anthropic', err).message }
      }
    },
  }
}
