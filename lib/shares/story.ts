// DR-021: the "How this article was made" story on a shared page. Pure: turns the article's provenance events
// into six steps (Brief → Research → AI draft → Human editing → Guideline check → Review), each with the people
// involved and a few human-in-the-loop numbers.

import type { HistoryEvent } from '@/lib/articles/history-format'

export type StoryStepKey = 'brief' | 'research' | 'draft' | 'editing' | 'check' | 'review'

export interface StoryPerson {
  name: string
  image: string | null
}

export interface StoryStep {
  key: StoryStepKey
  label: string
  /** Who does this step: the AI, people, or both. */
  actor: 'human' | 'ai' | 'both'
  state: 'done' | 'skipped' | 'pending'
  people: StoryPerson[]
  /** Newest activity in this step (ISO). */
  at: string | null
  stats: string[]
}

export interface StoryInput {
  events: HistoryEvent[]
  researchEnabled: boolean
  status: string
  score: number | null
}

const nf = new Intl.NumberFormat('en-US')
const plural = (n: number, one: string, many = `${one}s`) => `${nf.format(n)} ${n === 1 ? one : many}`
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function collect(events: HistoryEvent[], types: string[]) {
  const hits = events.filter((e) => types.includes(e.type))
  const people = new Map<string, StoryPerson>()
  for (const e of hits) if (e.userId && e.userName) people.set(e.userId, { name: e.userName, image: e.userImage })
  const at = hits.reduce<string | null>((max, e) => (!max || e.at > max ? e.at : max), null)
  return { hits, people: [...people.values()], at }
}

export function buildStory({ events, researchEnabled, status, score }: StoryInput): StoryStep[] {
  const count = (type: string) => events.filter((e) => e.type === type).length

  // 1. Brief
  const brief = collect(events, ['created', 'imported', 'fields_edited'])
  const briefEdits = count('fields_edited')
  const briefStats = [events.some((e) => e.type === 'imported') ? 'Imported from the content calendar' : 'Written by the team']
  if (briefEdits) briefStats.push(`Refined ${plural(briefEdits, 'time')}`)

  // 2. Research
  const research = collect(events, ['researched', 'research_edited', 'sources_changed'])
  const runs = research.hits.filter((e) => e.type === 'researched')
  const lastRun = runs.reduce<HistoryEvent | null>((a, e) => (!a || e.at > a.at ? e : a), null)
  const sources = num(lastRun?.payload?.citations)
  const researchStats: string[] = []
  if (sources !== null) researchStats.push(`${plural(sources, 'source')} found`)
  if (count('research_edited') || count('sources_changed')) researchStats.push('Reviewed and curated by an editor')

  // 3. AI draft
  const draft = collect(events, ['generated', 'revised'])
  const generations = count('generated')
  const revisions = count('revised')
  const firstDraft = draft.hits.filter((e) => e.type === 'generated').reduce<HistoryEvent | null>((a, e) => (!a || e.at < a.at ? e : a), null)
  const draftStats: string[] = []
  const firstWords = num(firstDraft?.payload?.wordCount)
  if (firstWords !== null) draftStats.push(`First draft: ${plural(firstWords, 'word')}`)
  if (generations > 1) draftStats.push(`Regenerated ${plural(generations - 1, 'time')}`)
  if (revisions) draftStats.push(`Revised with editor feedback ${plural(revisions, 'time')}`)

  // 4. Human editing
  const editing = collect(events, ['draft_edited', 'ai_edit_applied', 'version_saved', 'restored'])
  let added = 0
  let removed = 0
  const sessions = editing.hits.filter((e) => e.type === 'draft_edited')
  for (const e of sessions) {
    const d = (num(e.payload?.wordsAfter) ?? 0) - (num(e.payload?.wordsBefore) ?? 0)
    if (d >= 0) added += d
    else removed -= d
  }
  const editingStats: string[] = []
  if (sessions.length) editingStats.push(`${plural(sessions.length, 'editing session')} · +${nf.format(added)} / −${nf.format(removed)} words`)
  const aiAssists = count('ai_edit_applied')
  if (aiAssists) editingStats.push(`${plural(aiAssists, 'AI-assisted rewrite')}, each approved by an editor`)
  if (editing.people.length > 1) editingStats.push(`${plural(editing.people.length, 'editor')} involved`)

  // 5. Guideline check
  const check = collect(events, ['guidelines_checked', 'suggestion_accepted', 'suggestion_reworded', 'suggestion_dismissed', 'checks_reviewed'])
  const applied = count('suggestion_accepted') + count('suggestion_reworded')
  const dismissed = count('suggestion_dismissed')
  const lastCheck = check.hits.filter((e) => e.type === 'guidelines_checked').reduce<HistoryEvent | null>((a, e) => (!a || e.at > a.at ? e : a), null)
  const rules = lastCheck?.payload?.rules as { universal?: number; client?: number } | undefined
  const checkStats: string[] = []
  if (score !== null) checkStats.push(`Score ${score}/100`)
  if (rules) checkStats.push(`${plural((rules.universal ?? 0) + (rules.client ?? 0), 'rule')} checked`)
  if (applied + dismissed) checkStats.push(`${plural(applied + dismissed, 'suggestion')} reviewed by an editor · ${nf.format(applied)} applied`)

  // 6. Review
  const review = collect(events, ['status_changed', 'client_approved', 'changes_requested'])
  const reviewMoves = review.hits.filter((e) => e.type === 'status_changed' && (e.toStatus === 'in_review' || e.toStatus === 'done'))
  const reviewStats: string[] = []
  if (status === 'done') reviewStats.push('Approved for publishing')
  else if (status === 'in_review') reviewStats.push('In editorial review')
  const lastDecision = review.hits
    .filter((e) => e.type === 'client_approved' || e.type === 'changes_requested')
    .reduce<HistoryEvent | null>((a, e) => (!a || e.at > a.at ? e : a), null)
  if (lastDecision) reviewStats.push(lastDecision.type === 'client_approved' ? 'Approved by the client' : 'Changes requested by the client')

  const reviewPeople = new Map<string, StoryPerson>()
  for (const e of reviewMoves) if (e.userId && e.userName) reviewPeople.set(e.userId, { name: e.userName, image: e.userImage })

  return [
    { key: 'brief', label: 'Brief & keywords', actor: 'human', state: brief.hits.length ? 'done' : 'pending', people: brief.people, at: brief.at, stats: briefStats },
    {
      key: 'research',
      label: 'Research',
      actor: 'both',
      state: runs.length ? 'done' : researchEnabled ? 'pending' : 'skipped',
      people: research.people,
      at: research.at,
      stats: runs.length ? researchStats : researchEnabled ? [] : ['Not needed for this piece'],
    },
    { key: 'draft', label: 'AI draft', actor: 'ai', state: generations ? 'done' : 'pending', people: draft.people, at: draft.at, stats: draftStats },
    {
      key: 'editing',
      label: 'Human editing',
      actor: 'human',
      state: sessions.length || aiAssists ? 'done' : 'pending',
      people: editing.people,
      at: editing.at,
      stats: editingStats,
    },
    { key: 'check', label: 'Guideline check', actor: 'both', state: lastCheck ? 'done' : 'pending', people: check.people, at: check.at, stats: checkStats },
    {
      key: 'review',
      label: 'Review',
      actor: 'human',
      state: status === 'done' || status === 'in_review' || lastDecision ? 'done' : 'pending',
      people: [...reviewPeople.values()],
      at: reviewMoves.concat(lastDecision ? [lastDecision] : []).reduce<string | null>((m, e) => (!m || e.at > m ? e.at : m), null),
      stats: reviewStats,
    },
  ]
}

/** Headline numbers for the hero ("people involved", "human edits"). */
export function storyTotals(events: HistoryEvent[]) {
  const people = new Set(events.filter((e) => e.userId).map((e) => e.userId))
  const humanActions = events.filter((e) =>
    ['fields_edited', 'draft_edited', 'ai_edit_applied', 'suggestion_accepted', 'suggestion_reworded', 'suggestion_dismissed', 'research_edited', 'sources_changed', 'status_changed', 'revised'].includes(e.type),
  ).length
  return { people: people.size, humanActions }
}
