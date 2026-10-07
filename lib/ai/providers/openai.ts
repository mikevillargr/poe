import 'server-only'
import OpenAI from 'openai'
import type { ResponseCreateParamsStreaming } from 'openai/resources/responses/responses'
import { AIError, type AIProvider, type AIStreamEvent, type GenerateParams, type Usage } from '../types'
import { listModelsWithFallback } from '../models/list'
import { supportsWebSearch } from '../models/merge'
import { acceptsTemperature, isReasoningModel, OpenAIStreamMapper } from './openai-map'
import { mapProviderError, reasoningFloor, throwIfAborted, type CredentialsLoader, type ProviderOptions } from './shared'

// OpenAI adapter: Responses API (streaming) for text, `web_search` tool for research.

const DEFAULT_MAX_TOKENS = 16000

export function createOpenAIProvider(loadCredentials: CredentialsLoader, opts: ProviderOptions = {}): AIProvider {
  let clientPromise: Promise<OpenAI> | null = null
  const client = () =>
    (clientPromise ??= loadCredentials().then(
      (c) => new OpenAI({ apiKey: c.apiKey, ...(c.baseUrl ? { baseURL: c.baseUrl } : {}), maxRetries: 2, ...(opts.fetch ? { fetch: opts.fetch } : {}) }),
    ))

  /** `think`: DR-016 reasoning summary, only for the streamed research and drafts. */
  function baseParams(model: string, p: GenerateParams, think = false): ResponseCreateParamsStreaming {
    return {
      model,
      stream: true,
      store: false,
      ...(p.system ? { instructions: p.system } : {}),
      input: p.messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: isReasoningModel(model) ? reasoningFloor(p.maxTokens, DEFAULT_MAX_TOKENS) : (p.maxTokens ?? DEFAULT_MAX_TOKENS),
      ...(p.temperature !== undefined && acceptsTemperature(model) ? { temperature: p.temperature } : {}),
      // DR-016: reasoning models stream a summary of their reasoning for the live "thinking" peek.
      ...(think && isReasoningModel(model) ? { reasoning: { summary: 'auto' as const } } : {}),
    }
  }

  async function* run(params: ResponseCreateParamsStreaming, signal: AbortSignal | undefined, mapper: OpenAIStreamMapper) {
    throwIfAborted(signal)
    try {
      const c = await client()
      const stream = await c.responses.create(params, { signal })
      for await (const ev of stream) for (const out of mapper.handle(ev)) yield out
    } catch (err) {
      throw mapProviderError('openai', err, signal)
    }
    if (mapper.usage) yield { type: 'usage', usage: mapper.usage } satisfies AIStreamEvent
    if (mapper.status === 'incomplete' && !mapper.text) {
      throw new AIError('PROVIDER_ERROR', `OpenAI returned no text (${mapper.incompleteReason ?? 'incomplete'}).`)
    }
  }

  return {
    id: 'openai',

    async listModels() {
      const creds = await loadCredentials().catch((err) => {
        if (err instanceof AIError && err.code === 'PROVIDER_NOT_CONFIGURED') return null
        throw err
      })
      return listModelsWithFallback('openai', creds, async () => {
        const c = await client()
        const out = []
        for await (const m of c.models.list()) out.push({ id: m.id })
        return out
      })
    },

    async *streamText(model, params) {
      const mapper = new OpenAIStreamMapper()
      yield* run(baseParams(model, params, true), params.signal, mapper)
      yield { type: 'done', text: mapper.text }
    },

    async generateText(model, params) {
      const mapper = new OpenAIStreamMapper()
      let usage: Usage | undefined
      for await (const ev of run(baseParams(model, params), params.signal, mapper)) {
        if (ev.type === 'usage') usage = ev.usage
      }
      return { text: mapper.text, usage }
    },

    async *research(model, params) {
      if (!supportsWebSearch('openai', model)) {
        throw new AIError('WEB_SEARCH_UNSUPPORTED', `${model} can't run web search.`)
      }
      const mapper = new OpenAIStreamMapper()
      const p: ResponseCreateParamsStreaming = {
        ...baseParams(model, params, true),
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        ...(params.maxSearches ? { max_tool_calls: params.maxSearches } : {}),
      }
      yield* run(p, params.signal, mapper)
      yield { type: 'done', text: mapper.text, citations: mapper.citations.list() }
    },

    async testKey() {
      try {
        const c = await client()
        await c.models.list()
        return { ok: true, message: 'OpenAI key works.' }
      } catch (err) {
        return { ok: false, message: mapProviderError('openai', err).message }
      }
    },
  }
}
