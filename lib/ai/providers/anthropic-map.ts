// Pure Anthropic mapping: model capability rules and Messages-stream → AIStreamEvent translation.
// No client here, so tests can replay recorded event shapes (see __fixtures__/anthropic-*.json).
//
// Sources (checked 2026-10-05):
// - platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool: tool versions
//   web_search_20250305 (basic) and web_search_20260209 (dynamic filtering, "Claude 4.6 and later
//   models"); streaming shape (server_tool_use + input_json_delta query, web_search_tool_result,
//   text blocks with `web_search_result_location` citations: url, title, cited_text ≤150 chars,
//   encrypted_index); errors arrive inside a 200 as web_search_tool_result_error; pause_turn.
// - platform.claude.com/docs/en/models/overview + the claude-api skill: Fable 5.1 / Opus 5.5 always
//   think (adaptive), sampling params (temperature) are rejected on Fable 5.x, Opus 5.x/4.7/4.8 and
//   Sonnet 5.x; server-side refusal fallbacks (`fallbacks: "default"`, beta
//   server-side-fallback-2026-07-01) for Fable 5.1, Opus 5.5, Opus 5 and Sonnet 5.5.
import type {
  BetaContentBlock,
  BetaRawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources/beta/messages/messages'
import type { AIStreamEvent, Citation } from '../types'
import { CitationCollector } from './shared'

/** 4.6-generation and later Claude models (adaptive thinking, dynamic-filtering web search). */
export function isModernClaude(model: string): boolean {
  return /^claude-(?:fable|mythos)-/.test(model) || /^claude-(?:opus|sonnet)-(?:[5-9]|4-[6-9])(?:\D|$)/.test(model)
}

export function webSearchToolType(model: string): 'web_search_20260209' | 'web_search_20250305' {
  return isModernClaude(model) ? 'web_search_20260209' : 'web_search_20250305'
}

/** temperature/top_p/top_k return 400 on these models. */
export function acceptsSampling(model: string): boolean {
  return !/^claude-(?:fable|mythos|opus-[5-9]|opus-4-[78]|sonnet-[5-9])/.test(model)
}

const FALLBACK_MODELS = new Set(['claude-fable-5-1', 'claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5'])
export const SERVER_FALLBACK_BETA = 'server-side-fallback-2026-07-01'

/** Models where we opt into server-side refusal fallbacks (`fallbacks: "default"`). */
export function usesServerFallback(model: string): boolean {
  return FALLBACK_MODELS.has(model)
}

/**
 * Translates raw stream events into contract events: text deltas, one `search` per web search
 * query, and one `citation` per new cited URL (numbered by first appearance).
 */
export class AnthropicStreamMapper {
  readonly citations = new CitationCollector()
  readonly queries: string[] = []
  text = ''
  private searchBlocks = new Map<number, { json: string; emitted: boolean }>()
  private resultTitles = new Map<string, string>()

  handle(ev: BetaRawMessageStreamEvent): AIStreamEvent[] {
    switch (ev.type) {
      case 'content_block_start':
        return this.onBlockStart(ev.index, ev.content_block)
      case 'content_block_delta': {
        const d = ev.delta
        if (d.type === 'thinking_delta') return d.thinking ? [{ type: 'thinking', text: d.thinking }] : []
        if (d.type === 'text_delta') {
          if (!d.text) return []
          this.text += d.text
          return [{ type: 'delta', text: d.text }]
        }
        if (d.type === 'citations_delta') return this.onCitation(d.citation)
        if (d.type === 'input_json_delta') {
          const b = this.searchBlocks.get(ev.index)
          if (b) b.json += d.partial_json
        }
        return []
      }
      case 'content_block_stop': {
        const b = this.searchBlocks.get(ev.index)
        if (!b || b.emitted) return []
        b.emitted = true
        return this.searchEvent(parseQuery(b.json))
      }
      default:
        return []
    }
  }

  /** Picks up anything in the final message the deltas didn't carry (non-streamed nested blocks). */
  finalize(content: BetaContentBlock[]): AIStreamEvent[] {
    const out: AIStreamEvent[] = []
    for (const block of content) {
      if (block.type === 'web_search_tool_result') this.recordResults(block)
      if (block.type === 'text' && block.citations) for (const c of block.citations) out.push(...this.onCitation(c))
    }
    return out
  }

  private onBlockStart(index: number, block: BetaContentBlock): AIStreamEvent[] {
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      const query = queryFrom(block.input)
      // The query normally streams as input_json_delta; nested (dynamic-filtering) calls can arrive whole.
      this.searchBlocks.set(index, { json: '', emitted: !!query })
      return query ? this.searchEvent(query) : []
    }
    if (block.type === 'web_search_tool_result') {
      this.recordResults(block)
      return []
    }
    if (block.type === 'text') {
      const out: AIStreamEvent[] = []
      if (block.text) {
        this.text += block.text
        out.push({ type: 'delta', text: block.text })
      }
      for (const c of block.citations ?? []) out.push(...this.onCitation(c))
      return out
    }
    return []
  }

  private recordResults(block: Extract<BetaContentBlock, { type: 'web_search_tool_result' }>) {
    if (!Array.isArray(block.content)) return // error object: max_uses_exceeded, unavailable, …
    for (const r of block.content) if (r.url && r.title) this.resultTitles.set(r.url, r.title)
  }

  private onCitation(c: unknown): AIStreamEvent[] {
    const cit = c as { type?: string; url?: string; title?: string | null; cited_text?: string }
    if (cit?.type !== 'web_search_result_location' || !cit.url) return []
    const added = this.citations.add({
      url: cit.url,
      title: cit.title ?? this.resultTitles.get(cit.url),
      snippet: cit.cited_text,
    })
    return added ? [{ type: 'citation', citation: { ...added } }] : []
  }

  private searchEvent(query: string | null): AIStreamEvent[] {
    if (!query) return []
    this.queries.push(query)
    return [{ type: 'search', query }]
  }

  citationList(): Citation[] {
    return this.citations.list()
  }
}

function queryFrom(input: unknown): string | null {
  const q = (input as { query?: unknown } | null)?.query
  return typeof q === 'string' && q.trim() ? q.trim() : null
}

function parseQuery(json: string): string | null {
  if (!json.trim()) return null
  try {
    return queryFrom(JSON.parse(json))
  } catch {
    return null
  }
}
