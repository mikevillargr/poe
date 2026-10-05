import 'server-only'
import OpenAI from 'openai'
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { AIError, type AIProvider, type AIStreamEvent, type GenerateParams, type Usage } from '../types'
import { listModelsWithFallback } from '../models/list'
import { supportsWebSearch } from '../models/merge'
import {
  acceptsTemperature,
  BUILTIN_WEB_SEARCH,
  builtinSearchTool,
  builtinToolResult,
  ChatTurnAccumulator,
  moonshotCitations,
  queryFromArguments,
  REST_WEB_SEARCH,
  restSearchTool,
  searchResultsToToolContent,
  type SearchResult,
  type ToolCall,
} from './moonshot-map'
import { mapProviderError, reasoningFloor, throwIfAborted, type CredentialsLoader, type ProviderOptions } from './shared'

// Moonshot (Kimi) adapter: OpenAI-compatible Chat Completions via the `openai` SDK + baseURL.
// Research runs a tool loop. Two search back ends:
// - 'builtin' (default): Kimi's `$web_search` builtin_function; the server searches and we echo
//   the arguments back. Moonshot retires it on 2026-10-20.
// - 'rest' (MOONSHOT_WEB_SEARCH=rest): a normal function tool that we execute with
//   POST {baseUrl}/tools/search, Moonshot's documented replacement. Also gives real titles/snippets.

const DEFAULT_MAX_TOKENS = 16000
// Same default as DEFAULT_BASE_URLS in lib/ai/secrets.ts (not imported: that module pulls in the DB).
const FALLBACK_BASE_URL = 'https://api.moonshot.ai/v1'

export type MoonshotSearchMode = 'builtin' | 'rest'

export function moonshotSearchMode(): MoonshotSearchMode {
  return process.env.MOONSHOT_WEB_SEARCH === 'rest' ? 'rest' : 'builtin'
}

export function createMoonshotProvider(loadCredentials: CredentialsLoader, opts: ProviderOptions & { searchMode?: MoonshotSearchMode } = {}): AIProvider {
  let clientPromise: Promise<{ sdk: OpenAI; apiKey: string; baseUrl: string }> | null = null
  const client = () =>
    (clientPromise ??= loadCredentials().then((c) => {
      const baseUrl = (c.baseUrl || FALLBACK_BASE_URL).replace(/\/+$/, '')
      return { sdk: new OpenAI({ apiKey: c.apiKey, baseURL: baseUrl, maxRetries: 2, ...(opts.fetch ? { fetch: opts.fetch } : {}) }), apiKey: c.apiKey, baseUrl }
    }))

  function baseParams(model: string, p: GenerateParams, messages: ChatCompletionMessageParam[]): ChatCompletionCreateParamsStreaming {
    return {
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages,
      max_completion_tokens: reasoningFloor(p.maxTokens, DEFAULT_MAX_TOKENS),
      ...(p.temperature !== undefined && acceptsTemperature(model) ? { temperature: p.temperature } : {}),
    }
  }

  function initialMessages(p: GenerateParams): ChatCompletionMessageParam[] {
    return [
      ...(p.system ? [{ role: 'system' as const, content: p.system }] : []),
      ...p.messages.map((m) => ({ role: m.role, content: m.content })),
    ]
  }

  async function* turn(params: ChatCompletionCreateParamsStreaming, signal: AbortSignal | undefined, acc: ChatTurnAccumulator) {
    throwIfAborted(signal)
    try {
      const { sdk } = await client()
      const stream = await sdk.chat.completions.create(params, { signal })
      for await (const chunk of stream) for (const ev of acc.handle(chunk)) yield ev
    } catch (err) {
      throw mapProviderError('moonshot', err, signal)
    }
  }

  async function restSearch(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
    const { apiKey, baseUrl } = await client()
    let res: Response
    try {
      res = await (opts.fetch ?? fetch)(`${baseUrl}/tools/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ text_query: query.slice(0, 500), limit: 8, timeout_seconds: 30 }),
        signal,
      })
    } catch (err) {
      throw mapProviderError('moonshot', err, signal)
    }
    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status === 429) throw mapProviderError('moonshot', { status: res.status })
      return [] // let the model carry on without this search
    }
    const body = (await res.json().catch(() => null)) as { search_results?: SearchResult[] } | null
    return (body?.search_results ?? []).filter((r) => typeof r?.url === 'string')
  }

  return {
    id: 'moonshot',

    async listModels() {
      const creds = await loadCredentials().catch((err) => {
        if (err instanceof AIError && err.code === 'PROVIDER_NOT_CONFIGURED') return null
        throw err
      })
      return listModelsWithFallback('moonshot', creds, async () => {
        const { sdk } = await client()
        const out = []
        for await (const m of sdk.models.list()) {
          const ctx = (m as { context_length?: unknown }).context_length
          out.push({ id: m.id, contextWindow: typeof ctx === 'number' ? ctx : undefined })
        }
        return out
      })
    },

    async *streamText(model, params) {
      const acc = new ChatTurnAccumulator()
      yield* turn(baseParams(model, params, initialMessages(params)), params.signal, acc)
      if (acc.usage) yield { type: 'usage', usage: acc.usage }
      yield { type: 'done', text: acc.content }
    },

    async generateText(model, params) {
      const acc = new ChatTurnAccumulator()
      for await (const _ of turn(baseParams(model, params, initialMessages(params)), params.signal, acc)) {
        // drain
      }
      return { text: acc.content, usage: acc.usage ?? undefined }
    },

    async *research(model, params) {
      if (!supportsWebSearch('moonshot', model)) {
        throw new AIError('WEB_SEARCH_UNSUPPORTED', `${model} can't run web search.`)
      }
      const mode = opts.searchMode ?? moonshotSearchMode()
      const maxSearches = params.maxSearches ?? 6
      const maxTurns = maxSearches + 3
      const messages = initialMessages(params)
      const usage: Usage = { inputTokens: 0, outputTokens: 0 }
      const results: SearchResult[] = []
      let text = ''
      let searches = 0
      let finished = false

      for (let i = 0; i < maxTurns && !finished; i++) {
        const acc = new ChatTurnAccumulator()
        const p = {
          ...baseParams(model, params, messages),
          tools: [mode === 'rest' ? restSearchTool : builtinSearchTool],
        } as unknown as ChatCompletionCreateParamsStreaming
        yield* turn(p, params.signal, acc)
        text += acc.content
        if (acc.usage) {
          usage.inputTokens += acc.usage.inputTokens
          usage.outputTokens += acc.usage.outputTokens
        }
        const calls = acc.toolCalls()
        if (acc.finishReason !== 'tool_calls' || !calls.length) {
          finished = true
          break
        }
        messages.push(acc.assistantMessage() as unknown as ChatCompletionMessageParam)
        for (const call of calls) {
          const { message, query } = await runTool(call)
          if (query) yield { type: 'search', query } satisfies AIStreamEvent
          messages.push(message as unknown as ChatCompletionMessageParam)
        }
      }

      yield { type: 'usage', usage }
      if (!finished) throw new AIError('PROVIDER_ERROR', 'Kimi kept searching without answering; try again.')
      const citations = moonshotCitations(text, results)
      for (const c of citations) yield { type: 'citation', citation: c }
      yield { type: 'done', text, citations }

      async function runTool(call: ToolCall) {
        const query = queryFromArguments(call.arguments)
        if (call.name === BUILTIN_WEB_SEARCH) {
          searches++
          return { message: builtinToolResult(call), query }
        }
        if (call.name !== REST_WEB_SEARCH) {
          return { message: { role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify({ error: 'unknown tool' }) }, query: null }
        }
        if (!query || searches >= maxSearches) {
          const error = query ? 'Search limit reached. Answer with the sources you already have.' : 'Missing query.'
          return { message: { role: 'tool', tool_call_id: call.id, name: call.name, content: JSON.stringify({ error }) }, query: null }
        }
        searches++
        const found = await restSearch(query, params.signal)
        results.push(...found)
        return { message: { role: 'tool', tool_call_id: call.id, name: call.name, content: searchResultsToToolContent(found) }, query }
      }
    },

    async testKey() {
      try {
        const { sdk } = await client()
        await sdk.models.list()
        return { ok: true, message: 'Moonshot key works.' }
      } catch (err) {
        return { ok: false, message: mapProviderError('moonshot', err).message }
      }
    },
  }
}
