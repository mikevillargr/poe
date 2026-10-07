// Pure Moonshot (Kimi) mapping: Chat Completions stream accumulation, the $web_search tool loop
// messages, and citations parsed from the numbered source list. No client (tests replay
// __fixtures__/moonshot-*.json).
//
// Sources (checked 2026-10-05):
// - platform.kimi.ai/docs/guide/use-web-search: declare
//   `{ type: "builtin_function", function: { name: "$web_search" } }`; when finish_reason is
//   "tool_calls", append the assistant message, then for each call a
//   `{ role: "tool", tool_call_id, name, content: JSON.stringify(arguments) }` message and call
//   again. "kimi-k3 always reasons, and kimi-k2.6 can also perform web search with thinking
//   enabled." The page also says $web_search "Retires on October 20, 2026" in favour of
//   POST /v1/tools/search (see `restSearchTool` below).
// - platform.kimi.ai/docs/guide/use-kimi-k2-thinking-model: during multi-step tool calls "keep all
//   of the reasoning content from the context (the `reasoning_content` field) and send it back";
//   in streams `reasoning_content` arrives before `content`; set max_tokens >= 16000; kimi-k2.6 /
//   kimi-k2.7-code don't accept a custom temperature, and kimi-k3 fixes it at 1.0.
// - platform.kimi.ai/docs/api/chat: `usage` is on the last chunk (top level) when
//   stream_options.include_usage is set; `max_completion_tokens` replaces `max_tokens`.
// - platform.kimi.ai/docs/api/tools-search: POST /v1/tools/search { text_query, limit (1–20),
//   timeout_seconds (1–60), include_content } → { search_results: [{ title, url, snippet, date,
//   site_name, … }] }.
import type { AIStreamEvent, Citation, Usage } from '../types'
import { normalizeUrl, parseNumberedSources } from './shared'

export const BUILTIN_WEB_SEARCH = '$web_search'
export const REST_WEB_SEARCH = 'web_search'

export const builtinSearchTool = { type: 'builtin_function', function: { name: BUILTIN_WEB_SEARCH } } as const

export const restSearchTool = {
  type: 'function',
  function: {
    name: REST_WEB_SEARCH,
    description: 'Search the live web. Returns up to 8 results with title, url, snippet and date.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'The search query.' } },
      required: ['query'],
    },
  },
} as const

/** Moonshot models don't take a custom temperature (k2.6 / k2.7-code reject it, k3 fixes it at 1.0). */
export function acceptsTemperature(model: string): boolean {
  return !/^kimi-/.test(model)
}

export interface ToolCall {
  id: string
  name: string
  arguments: string
}

interface ChunkLike {
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }>
    }
    finish_reason?: string | null
    usage?: { prompt_tokens?: number; completion_tokens?: number } | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null
}

/** Accumulates one streamed completion (one iteration of the tool loop). */
export class ChatTurnAccumulator {
  content = ''
  reasoning = ''
  finishReason: string | null = null
  usage: Usage | null = null
  private calls = new Map<number, ToolCall>()

  handle(chunk: ChunkLike): AIStreamEvent[] {
    const out: AIStreamEvent[] = []
    const u = chunk.usage ?? chunk.choices?.[0]?.usage
    if (u) this.usage = { inputTokens: u.prompt_tokens ?? 0, outputTokens: u.completion_tokens ?? 0 }
    for (const choice of chunk.choices ?? []) {
      const d = choice.delta
      if (d?.reasoning_content) {
        this.reasoning += d.reasoning_content
        out.push({ type: 'thinking', text: d.reasoning_content })
      }
      if (d?.content) {
        this.content += d.content
        out.push({ type: 'delta', text: d.content })
      }
      for (const tc of d?.tool_calls ?? []) {
        const i = tc.index ?? 0
        const cur = this.calls.get(i) ?? { id: '', name: '', arguments: '' }
        if (tc.id) cur.id = tc.id
        if (tc.function?.name) cur.name = tc.function.name
        if (tc.function?.arguments) cur.arguments += tc.function.arguments
        this.calls.set(i, cur)
      }
      if (choice.finish_reason) this.finishReason = choice.finish_reason
    }
    return out
  }

  toolCalls(): ToolCall[] {
    return [...this.calls.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)
  }

  /** The assistant message to append before the tool results (reasoning_content kept, per docs). */
  assistantMessage() {
    return {
      role: 'assistant' as const,
      content: this.content,
      ...(this.reasoning ? { reasoning_content: this.reasoning } : {}),
      tool_calls: this.toolCalls().map((c) => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
    }
  }
}

/** The search query, if the tool arguments carry one (the builtin's arguments are opaque). */
export function queryFromArguments(args: string): string | null {
  try {
    const v = JSON.parse(args) as { query?: unknown; search_query?: unknown }
    const q = v?.query ?? v?.search_query
    return typeof q === 'string' && q.trim() ? q.trim() : null
  } catch {
    return null
  }
}

/** Builtin $web_search: the server runs the search; we echo the call's arguments back unchanged. */
export function builtinToolResult(call: ToolCall) {
  let content = call.arguments
  try {
    content = JSON.stringify(JSON.parse(call.arguments))
  } catch {
    // Not JSON: echo verbatim.
  }
  return { role: 'tool' as const, tool_call_id: call.id, name: call.name, content }
}

export interface SearchResult {
  title?: string
  url: string
  snippet?: string
  date?: string
  site_name?: string
}

/** Trims /v1/tools/search results to what the model needs as the tool message content. */
export function searchResultsToToolContent(results: SearchResult[]): string {
  return JSON.stringify(
    results.slice(0, 8).map((r) => ({
      title: r.title,
      url: r.url,
      ...(r.site_name ? { site: r.site_name } : {}),
      ...(r.date ? { date: r.date } : {}),
      snippet: r.snippet?.slice(0, 800),
    })),
  )
}

/**
 * Citations for a Kimi research answer: the numbered <sources> list the prompt asks for (so ids
 * match the inline [n] markers), enriched with titles/snippets from structured search results when
 * the REST search tool was used. If the model wrote no list, the search results themselves are used.
 */
export function moonshotCitations(text: string, results: SearchResult[] = []): Citation[] {
  const byUrl = new Map<string, SearchResult>()
  for (const r of results) {
    const k = normalizeUrl(r.url)
    if (k && !byUrl.has(k)) byUrl.set(k, r)
  }
  const parsed = parseNumberedSources(text)
  if (parsed.length) {
    return parsed.map((c) => {
      const r = byUrl.get(normalizeUrl(c.url) ?? '')
      return {
        ...c,
        ...(!c.title && r?.title ? { title: r.title } : {}),
        ...(r?.snippet ? { snippet: r.snippet.slice(0, 500) } : {}),
      }
    })
  }
  return [...byUrl.values()].map((r, i) => ({
    id: String(i + 1),
    url: r.url,
    ...(r.title ? { title: r.title } : {}),
    ...(r.snippet ? { snippet: r.snippet.slice(0, 500) } : {}),
  }))
}
