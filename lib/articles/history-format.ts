// DR-020: turns article_events rows into History panel entries (pure, shared by server and client).

import { ARTICLE_STATUS_LABELS, type ArticleStatus } from './schemas'

export interface HistoryEvent {
  id: string
  type: string
  at: string
  userId: string | null
  userName: string | null
  userImage: string | null
  fromStatus: string | null
  toStatus: string | null
  payload: Record<string, unknown> | null
}

export interface HistoryOrigin {
  createdAt: string
  createdByName: string | null
  importFilename: string | null
  /** Set for rows synced from a Google Sheet (`<source>:<row>`). */
  sheetRow: number | null
}

export interface HistoryData {
  events: HistoryEvent[]
  /** Names for user ids mentioned in payloads (owner changes). */
  people: Record<string, string>
  origin: HistoryOrigin
}

export type HistoryGroup = 'status' | 'writing' | 'ai' | 'suggestions' | 'research' | 'feedback'

export const HISTORY_FILTERS: { id: HistoryGroup | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'status', label: 'Status' },
  { id: 'writing', label: 'Writing' },
  { id: 'ai', label: 'AI' },
  { id: 'suggestions', label: 'Suggestions' },
  { id: 'research', label: 'Research' },
  { id: 'feedback', label: 'Feedback' },
]

const GROUP: Record<string, HistoryGroup> = {
  created: 'status',
  imported: 'status',
  status_changed: 'status',
  assigned: 'status',
  template_set: 'status',
  shared: 'status',
  fields_edited: 'writing',
  draft_edited: 'writing',
  version_saved: 'writing',
  restored: 'writing',
  exported: 'writing',
  generated: 'ai',
  revised: 'ai',
  ai_edit_applied: 'ai',
  guidelines_checked: 'suggestions',
  suggestion_accepted: 'suggestions',
  suggestion_dismissed: 'suggestions',
  suggestion_restored: 'suggestions',
  suggestion_reworded: 'suggestions',
  checks_reviewed: 'suggestions',
  researched: 'research',
  research_edited: 'research',
  sources_changed: 'research',
  research_setting: 'research',
  comment_added: 'feedback',
  comment_reply: 'feedback',
  comment_resolved: 'feedback',
  comment_reopened: 'feedback',
  client_approved: 'feedback',
  changes_requested: 'feedback',
}

export function historyGroup(type: string): HistoryGroup {
  return GROUP[type] ?? 'writing'
}

const FIELD_LABELS: Record<string, string> = {
  title: 'title',
  brief: 'brief',
  keywords: 'keywords',
  primaryKeyword: 'primary keyword',
  targetWordCount: 'target word count',
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field
}

const status = (s: unknown) => (typeof s === 'string' ? (ARTICLE_STATUS_LABELS[s as ArticleStatus] ?? s) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
const nf = new Intl.NumberFormat('en-US')
const RESEARCH_PARTS: Record<string, string> = { summary: 'summary', outline: 'outline', notes: 'notes', facts: 'facts' }

function list(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

/** The sentence after the person's name, e.g. "moved it from Draft to In Review". */
export function describeHistoryEvent(e: HistoryEvent, people: Record<string, string> = {}): string {
  const p = e.payload ?? {}
  switch (e.type) {
    case 'created':
      return 'added the article'
    case 'imported':
      return 'imported the article'
    case 'status_changed':
      return e.fromStatus ? `moved it from ${status(e.fromStatus)} to ${status(e.toStatus)}` : `set the status to ${status(e.toStatus)}`
    case 'assigned': {
      const to = str(p.to)
      if (p.reason === 'started generation') return 'became the owner by starting a run'
      if (!to) return 'removed the owner'
      return to === e.userId ? 'took ownership' : `assigned it to ${people[to] ?? 'someone'}`
    }
    case 'shared':
      return p.action === 'revoked' ? 'turned off the share link' : p.action === 'reset' ? 'reset the share link' : 'created a share link'
    case 'template_set':
      return str(p.templateName) ? `set the template to ${p.templateName}` : 'removed the template'
    case 'fields_edited': {
      const changes = (p.changes as { field: string }[] | undefined) ?? []
      return changes.length ? `edited the ${list(changes.map((c) => fieldLabel(c.field)))}` : 'edited the brief'
    }
    case 'draft_edited':
      return 'edited the draft'
    case 'version_saved':
      return str(p.label) ? `saved version ${p.versionNo} “${p.label}”` : `saved version ${p.versionNo ?? ''}`.trim()
    case 'restored':
      return `restored version ${p.fromVersionNo ?? ''}`.trim()
    case 'exported':
      return p.format === 'google-doc' ? 'exported it to Google Docs' : 'downloaded it as DOCX'
    case 'generated':
      return p.snapshotVersionNo ? 'regenerated the draft' : 'generated a draft'
    case 'revised':
      return 'revised the draft with AI'
    case 'ai_edit_applied':
      return p.mode === 'insert' ? 'inserted AI-written text' : 'applied an AI rewrite'
    case 'guidelines_checked': {
      const score = num(p.score)
      return score !== null ? `checked it against guidelines (score ${score})` : 'checked it against guidelines'
    }
    case 'suggestion_accepted':
      return 'applied a suggestion'
    case 'suggestion_dismissed':
      return 'dismissed a suggestion'
    case 'suggestion_restored':
      return 'brought back a suggestion'
    case 'suggestion_reworded':
      return 'reworded and applied a suggestion'
    case 'checks_reviewed':
      return 'reviewed the template checks'
    case 'researched':
      return 'ran research'
    case 'research_edited': {
      const parts = ((p.parts as string[] | undefined) ?? []).map((x) => RESEARCH_PARTS[x] ?? x)
      return parts.length ? `edited the research ${list(parts)}` : 'edited the research'
    }
    case 'sources_changed':
      return 'changed which sources are used'
    case 'research_setting':
      return p.on ? 'turned research on' : 'turned research off'
    case 'comment_added':
      return p.quote ? 'commented on a passage' : 'left a comment'
    case 'comment_reply':
      return 'replied to a comment'
    case 'comment_resolved':
      return 'resolved a comment'
    case 'comment_reopened':
      return 'reopened a comment'
    case 'client_approved':
      return 'approved the article'
    case 'changes_requested':
      return 'requested changes'
    default:
      return e.type.replace(/_/g, ' ')
  }
}

/** Who did it: the staff member, or the name a guest gave on a shared link (DR-021). */
export function historyActor(e: HistoryEvent): string {
  if (e.userName) return e.userName
  const name = e.payload?.name
  return typeof name === 'string' && name ? name : 'Poe'
}

/** A short secondary line (word counts, models, scores), or null. */
export function historyMeta(e: HistoryEvent): string | null {
  const p = e.payload ?? {}
  switch (e.type) {
    case 'draft_edited': {
      const before = num(p.wordsBefore)
      const after = num(p.wordsAfter)
      if (before === null || after === null) return null
      const d = after - before
      const saves = num(p.saves)
      return `${d >= 0 ? '+' : '−'}${nf.format(Math.abs(d))} words · ${nf.format(after)} total${saves && saves > 1 ? ` · ${saves} saves` : ''}`
    }
    case 'generated':
    case 'revised': {
      const bits = [num(p.wordCount) !== null ? `${nf.format(p.wordCount as number)} words` : null, str(p.model)?.split(':').pop() ?? null]
      return bits.filter(Boolean).join(' · ') || null
    }
    case 'guidelines_checked': {
      const s = num(p.suggestions)
      const r = p.rules as { universal?: number; client?: number } | undefined
      const rules = r ? (r.universal ?? 0) + (r.client ?? 0) : null
      return [s !== null ? `${s} suggestion${s === 1 ? '' : 's'}` : null, rules !== null ? `${rules} rules` : null].filter(Boolean).join(' · ') || null
    }
    case 'comment_added':
    case 'comment_reply':
    case 'comment_resolved':
    case 'comment_reopened':
      return str(p.quote) ? `“${(p.quote as string).slice(0, 120)}”` : null
    case 'changes_requested':
      return str(p.note) ? (p.note as string).slice(0, 200) : null
    case 'researched': {
      const c = num(p.citations)
      return [c !== null ? `${c} source${c === 1 ? '' : 's'}` : null, str(p.model)?.split(':').pop() ?? null].filter(Boolean).join(' · ') || null
    }
    case 'sources_changed': {
      const total = num(p.total)
      const excluded = num(p.excluded)
      return total !== null && excluded !== null ? `${total - excluded} of ${total} sources used` : null
    }
    case 'suggestion_accepted':
    case 'suggestion_dismissed':
    case 'suggestion_restored':
    case 'suggestion_reworded':
      return str(p.title)
    default:
      return null
  }
}

/** Groups newest-first events into day buckets ("Today", "Yesterday", "Mon, Oct 5"). */
export function groupByDay<T extends { at: string }>(events: T[], now = new Date()): { label: string; events: T[] }[] {
  const out: { label: string; events: T[] }[] = []
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const today = key(now)
  const yesterday = key(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  for (const e of events) {
    const d = new Date(e.at)
    const k = key(d)
    const label =
      k === today
        ? 'Today'
        : k === yesterday
          ? 'Yesterday'
          : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
    const last = out[out.length - 1]
    if (last && last.label === label) last.events.push(e)
    else out.push({ label, events: [e] })
  }
  return out
}

/** Event types the client may report itself (things that only happen in the browser). */
export const CLIENT_EVENT_TYPES = ['ai_edit_applied', 'exported'] as const
