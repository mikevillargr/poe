// Pure helpers shared by the real provider adapters (no SDK clients, no 'server-only', so unit tests
// can import them directly). Owned by WS-ai.
import { AIError, type Citation, type ProviderId } from '../types'

// ---------------------------------------------------------------------------------------------
// Abort handling. The pipeline (lib/pipeline/stream.ts, lib/ai/sse.ts) recognises a client
// disconnect as `DOMException` named 'AbortError', so SDK-specific abort errors are normalised.

export function abortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

export function isAbortLike(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  const name = (err as { name?: unknown } | null)?.name
  // Both SDKs throw `APIUserAbortError` when the request's AbortSignal fires.
  return name === 'APIUserAbortError' || name === 'AbortError'
}

// ---------------------------------------------------------------------------------------------
// Error mapping. Both SDKs expose `status` on their APIError subclasses; we map on status rather
// than class identity so one function serves all three providers (and is testable without SDKs).

const LABEL: Record<ProviderId, string> = { anthropic: 'Anthropic', openai: 'OpenAI', moonshot: 'Moonshot' }

/** Removes anything that looks like an API key from a provider error message. */
export function redactSecrets(message: string): string {
  return message
    .replace(/\bsk-[A-Za-z0-9_\-]*\*+[A-Za-z0-9]*/g, 'sk-…') // provider-masked echoes (sk-abcd****1234)
    .replace(/\bsk-[A-Za-z0-9_\-]{8,}/g, 'sk-…')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._\-]{8,}/gi, '$1…')
}

function providerMessage(err: unknown): string {
  const e = err as { error?: { error?: { message?: unknown }; message?: unknown }; message?: unknown } | null
  const nested = e?.error?.error?.message ?? e?.error?.message
  const raw = typeof nested === 'string' && nested ? nested : typeof e?.message === 'string' ? e.message : ''
  return redactSecrets(raw).slice(0, 500)
}

/**
 * Converts an SDK / HTTP error into the contract's `AIError` (or a DOMException AbortError).
 * 401/403 → INVALID_API_KEY, 429 → RATE_LIMITED, anything else → PROVIDER_ERROR.
 */
export function mapProviderError(provider: ProviderId, err: unknown, signal?: AbortSignal): Error {
  if (err instanceof AIError) return err
  if (isAbortLike(err, signal)) return abortError()
  const status = (err as { status?: unknown } | null)?.status
  const detail = providerMessage(err)
  if (status === 401 || status === 403) {
    return new AIError('INVALID_API_KEY', `${LABEL[provider]} rejected the API key (${status}).${detail ? ` ${detail}` : ''}`)
  }
  if (status === 429) {
    return new AIError('RATE_LIMITED', `${LABEL[provider]} rate limit or quota reached (429).${detail ? ` ${detail}` : ''}`)
  }
  const prefix = typeof status === 'number' ? `${LABEL[provider]} error ${status}` : `${LABEL[provider]} request failed`
  return new AIError('PROVIDER_ERROR', `${prefix}${detail ? `: ${detail}` : '.'}`)
}

// ---------------------------------------------------------------------------------------------
// Citations: de-duplicated by normalised URL, numbered "1", "2", … in order of first appearance.

export function normalizeUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  u.hash = ''
  for (const k of [...u.searchParams.keys()]) if (/^utm_/i.test(k)) u.searchParams.delete(k)
  const path = u.pathname.replace(/\/+$/, '')
  const search = u.searchParams.toString()
  return `${u.protocol}//${u.host.toLowerCase()}${path}${search ? `?${search}` : ''}`
}

/** Removes utm_* parameters (OpenAI appends utm_source=openai to cited URLs); keeps the rest. */
export function stripTracking(raw: string): string {
  const trimmed = raw.trim()
  try {
    const u = new URL(trimmed)
    const keys = [...u.searchParams.keys()].filter((k) => /^utm_/i.test(k))
    if (!keys.length) return trimmed
    for (const k of keys) u.searchParams.delete(k)
    return u.toString()
  } catch {
    return trimmed
  }
}

export class CitationCollector {
  private byKey = new Map<string, Citation>()
  private ordered: Citation[] = []

  /** Adds a source. Returns the new Citation the first time a URL is seen, otherwise null. */
  add(input: { url: string; title?: string | null; snippet?: string | null }): Citation | null {
    const key = normalizeUrl(input.url)
    if (!key) return null
    const existing = this.byKey.get(key)
    if (existing) {
      // Fill gaps on later mentions, but never renumber or overwrite.
      if (!existing.title && input.title) existing.title = clean(input.title)
      if (!existing.snippet && input.snippet) existing.snippet = clean(input.snippet)
      return null
    }
    const c: Citation = { id: String(this.ordered.length + 1), url: stripTracking(input.url) }
    if (input.title && clean(input.title)) c.title = clean(input.title)
    if (input.snippet && clean(input.snippet)) c.snippet = clean(input.snippet)
    this.byKey.set(key, c)
    this.ordered.push(c)
    return c
  }

  get(url: string): Citation | undefined {
    const key = normalizeUrl(url)
    return key ? this.byKey.get(key) : undefined
  }

  list(): Citation[] {
    return this.ordered.map((c) => ({ ...c }))
  }

  get size() {
    return this.ordered.length
  }
}

function clean(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------------------------
// Numbered source list → Citation[] (Kimi returns no structured citations).
// The research prompt (lib/prompts/research.ts) asks for:  <sources>\n[n] Title — https://url\n</sources>

const URL_RE = /https?:\/\/[^\s<>()\]]+[^\s<>()\].,;:!?'"»”]/

export function parseNumberedSources(text: string): Citation[] {
  const block = /<sources>([\s\S]*?)(?:<\/sources>|$)/i.exec(text)
  // Without the tag, look at the text after a "Sources" / "References" heading.
  const heading = block ? null : /(?:^|\n)\s*(?:#+\s*|\*\*)?(?:sources|references)\b[^\n]*\n([\s\S]*)$/i.exec(text)
  const body = block?.[1] ?? heading?.[1] ?? ''
  const out: Citation[] = []
  const seen = new Set<string>()
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    const num = /^(?:[-*]\s*)?\[?(\d{1,3})\]?[.):]?\s+(.*)$/.exec(line)
    if (!num) continue
    const rest = num[2]
    // Markdown link form: [Title](https://url)
    const md = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(rest)
    let url: string | undefined
    let title: string | undefined
    if (md) {
      title = md[1]
      url = md[2]
    } else {
      const m = URL_RE.exec(rest)
      if (!m) continue
      url = m[0]
      title = rest.slice(0, m.index)
    }
    title = title
      ?.replace(/[<>]/g, '')
      .replace(/\s*[—–\-:|]\s*$/, '')
      .replace(/^["“]|["”]$/g, '')
      .trim()
    const key = normalizeUrl(url)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({ id: num[1], url, ...(title ? { title } : {}) })
  }
  return out
}

/** Floors max_tokens for reasoning models, whose thinking counts against the same budget. */
export function reasoningFloor(requested: number | undefined, fallback: number, floor = 16000): number {
  return Math.max(requested ?? fallback, floor)
}

/** Resolves `{ apiKey, baseUrl }` for a provider (DB → env in the app; env only in the smoke script). */
export type CredentialsLoader = () => Promise<{ apiKey: string; baseUrl?: string }>

export interface ProviderOptions {
  /** Custom fetch for the SDK client (tests replay recorded HTTP/SSE payloads through it). */
  fetch?: typeof fetch
}
