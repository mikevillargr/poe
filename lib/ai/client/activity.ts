// DR-016: what a running research / draft / template run is doing, derived from its stream events (pure, so it
// can be unit-tested and shared by the workspace and the Home batch drawer).

import type { AIStreamEvent } from '../types'

export type ActivityPhase = 'starting' | 'thinking' | 'searching' | 'reading' | 'selecting' | 'writing' | 'checking' | 'done'

export interface FeedItem {
  id: number
  kind: 'search' | 'sources' | 'step'
  text: string
  /** For `sources`: the URLs read, in order. */
  urls?: string[]
  at: number
}

export interface ActivityState {
  phase: ActivityPhase
  /** The model's readable reasoning so far (display only). */
  thinking: string
  thinkingStartedAt: number | null
  thinkingEndedAt: number | null
  feed: FeedItem[]
  /** Characters of visible output streamed so far (after any template retry reset). */
  textChars: number
  sources: number
  searches: number
}

export function initialActivity(): ActivityState {
  return { phase: 'starting', thinking: '', thinkingStartedAt: null, thinkingEndedAt: null, feed: [], textChars: 0, sources: 0, searches: 0 }
}

const STEP_PHASE: Record<string, ActivityPhase> = {
  selecting: 'selecting',
  writing: 'writing',
  retrying: 'writing',
  checking: 'checking',
  'needs-review': 'done',
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Folds one stream event into the activity view. `now` is passed in so tests are deterministic. */
export function reduceActivity(s: ActivityState, ev: AIStreamEvent, now: number): ActivityState {
  const nextId = (s.feed.at(-1)?.id ?? 0) + 1
  switch (ev.type) {
    case 'thinking':
      return {
        ...s,
        thinking: s.thinking + ev.text,
        thinkingStartedAt: s.thinkingStartedAt ?? now,
        thinkingEndedAt: now,
        phase: s.phase === 'starting' || s.phase === 'thinking' ? 'thinking' : s.phase,
      }
    case 'search':
      return { ...s, phase: 'searching', searches: s.searches + 1, feed: [...s.feed, { id: nextId, kind: 'search', text: ev.query, at: now }] }
    case 'citation': {
      const last = s.feed.at(-1)
      if (last?.kind === 'sources') {
        const urls = [...(last.urls ?? []), ev.citation.url]
        const updated: FeedItem = { ...last, urls, text: domain(urls[0]) }
        return { ...s, phase: 'reading', sources: s.sources + 1, feed: [...s.feed.slice(0, -1), updated] }
      }
      return {
        ...s,
        phase: 'reading',
        sources: s.sources + 1,
        feed: [...s.feed, { id: nextId, kind: 'sources', text: domain(ev.citation.url), urls: [ev.citation.url], at: now }],
      }
    }
    case 'delta':
      return { ...s, phase: s.phase === 'checking' ? s.phase : 'writing', textChars: s.textChars + ev.text.length }
    case 'reset':
      return { ...s, textChars: 0 }
    case 'step':
      return {
        ...s,
        phase: STEP_PHASE[ev.step] ?? s.phase,
        feed: [...s.feed, { id: nextId, kind: 'step', text: ev.label, at: now }],
      }
    case 'done':
    case 'saved':
      return { ...s, phase: 'done' }
    default:
      return s
  }
}

/** How long the model visibly thought, in ms (null if it didn't stream any thinking). */
export function thoughtFor(s: ActivityState): number | null {
  return s.thinkingStartedAt === null || s.thinkingEndedAt === null ? null : s.thinkingEndedAt - s.thinkingStartedAt
}

/** The last one or two sentences of the thinking trail, for the one-line peek. */
export function latestThought(thinking: string, maxChars = 180): string {
  const text = thinking.replace(/\s+/g, ' ').trim()
  if (text.length <= maxChars) return text
  const tail = text.slice(-maxChars)
  const cut = tail.search(/[.!?]\s+\S/)
  return cut >= 0 && cut < maxChars - 40 ? tail.slice(cut + 1).trim() : `…${tail.trimStart()}`
}
