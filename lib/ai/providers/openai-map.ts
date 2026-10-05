// Pure OpenAI mapping: Responses API stream events → AIStreamEvent, url_citation annotations →
// Citation, and model parameter rules. No client here (tests replay __fixtures__/openai-*.json).
//
// Sources (checked 2026-10-05):
// - developers.openai.com/api/docs/guides/tools-web-search: `tools: [{ type: "web_search" }]`, a
//   `web_search_call` output item (action search / open_page / find_in_page), a `message` item whose
//   output_text carries `url_citation` annotations (url, title, start/end index);
//   `include: ["web_search_call.action.sources"]` lists every URL consulted.
// - openai SDK 7.28 types (ResponseStreamEvent): response.output_text.delta,
//   response.output_text.annotation.added, response.output_item.done, response.completed /
//   response.incomplete / response.failed, error.
import type { ResponseStreamEvent, Response as OpenAIResponse } from 'openai/resources/responses/responses'
import { AIError, type AIStreamEvent, type Usage } from '../types'
import { CitationCollector } from './shared'

/** Reasoning models (gpt-5+, gpt-6, o-series) reject sampling params; only gpt-4.x accepts temperature. */
export function isReasoningModel(model: string): boolean {
  return /^(?:o\d|gpt-(?:[5-9]|\d{2}))/.test(model)
}

export function acceptsTemperature(model: string): boolean {
  return /^(?:gpt-4|chatgpt-4)/.test(model)
}

export class OpenAIStreamMapper {
  readonly citations = new CitationCollector()
  readonly queries: string[] = []
  text = ''
  usage: Usage | null = null
  /** 'completed' | 'incomplete' once the response has ended. */
  status: string | null = null
  incompleteReason: string | null = null

  handle(ev: ResponseStreamEvent): AIStreamEvent[] {
    switch (ev.type) {
      case 'response.output_text.delta':
        if (!ev.delta) return []
        this.text += ev.delta
        return [{ type: 'delta', text: ev.delta }]
      case 'response.output_text.annotation.added':
        return this.onAnnotation(ev.annotation)
      case 'response.output_item.done':
        if (ev.item.type === 'web_search_call') return this.onSearchCall(ev.item)
        return []
      case 'response.completed':
      case 'response.incomplete':
        return this.onEnd(ev.response)
      case 'response.failed': {
        const e = ev.response.error
        throw new AIError('PROVIDER_ERROR', `OpenAI response failed${e?.message ? `: ${e.message}` : '.'}`)
      }
      case 'error':
        throw new AIError(
          ev.code === 'rate_limit_exceeded' ? 'RATE_LIMITED' : 'PROVIDER_ERROR',
          `OpenAI stream error${ev.message ? `: ${ev.message}` : '.'}`,
        )
      default:
        return []
    }
  }

  private onAnnotation(a: unknown): AIStreamEvent[] {
    const ann = a as { type?: string; url?: string; title?: string } | null
    if (ann?.type !== 'url_citation' || !ann.url) return []
    const added = this.citations.add({ url: ann.url, title: ann.title })
    return added ? [{ type: 'citation', citation: { ...added } }] : []
  }

  private onSearchCall(item: { action?: unknown }): AIStreamEvent[] {
    const action = item.action as { type?: string; queries?: unknown; query?: unknown } | undefined
    if (action?.type !== 'search') return []
    const list = Array.isArray(action.queries) ? action.queries : typeof action.query === 'string' ? [action.query] : []
    const out: AIStreamEvent[] = []
    for (const q of list) {
      if (typeof q !== 'string' || !q.trim() || this.queries.includes(q.trim())) continue
      this.queries.push(q.trim())
      out.push({ type: 'search', query: q.trim() })
    }
    return out
  }

  /** Final response: usage, plus any annotations / search calls the deltas didn't carry. */
  private onEnd(res: OpenAIResponse): AIStreamEvent[] {
    this.status = res.status ?? 'completed'
    this.incompleteReason = res.incomplete_details?.reason ?? null
    if (res.usage) this.usage = { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    const out: AIStreamEvent[] = []
    let finalText = ''
    for (const item of res.output ?? []) {
      if (item.type === 'web_search_call') out.push(...this.onSearchCall(item))
      if (item.type !== 'message') continue
      for (const part of item.content) {
        if (part.type !== 'output_text') continue
        finalText += part.text
        for (const a of part.annotations ?? []) out.push(...this.onAnnotation(a))
      }
    }
    // Non-streamed or partially streamed output: trust the final text.
    if (!this.text && finalText) {
      this.text = finalText
      out.unshift({ type: 'delta', text: finalText })
    }
    return out
  }
}
