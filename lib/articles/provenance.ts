import 'server-only'
import { and, desc, eq, gt, inArray, isNull, max } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleEvents, articleVersions } from '@/lib/db/schema'
import { countWords } from './text'

// DR-020: the article's provenance, one log (`article_events`). Frequent actions are coalesced: one entry per
// person per editing burst (window), updated in place, so History reads like a story rather than a save log.

type Exec = Pick<typeof db, 'select' | 'insert' | 'update'>

export interface EventInput {
  tenantId: string
  articleId: string
  userId: string | null
  type: string
  payload?: Record<string, unknown> | null
  /** Merge into the same person's last event of this type when it is newer than this many ms. */
  coalesceMs?: number
  /** How to merge the new payload into the previous one (default: shallow, new wins). */
  merge?: (prev: Record<string, unknown>, next: Record<string, unknown>) => Record<string, unknown>
}

/** Records (or coalesces) one provenance event. Returns true when it started a new entry. */
export async function recordArticleEvent(exec: Exec, e: EventInput): Promise<boolean> {
  if (e.coalesceMs) {
    const since = new Date(Date.now() - e.coalesceMs)
    const [last] = await exec
      .select({ id: articleEvents.id, payload: articleEvents.payload })
      .from(articleEvents)
      .where(
        and(
          eq(articleEvents.articleId, e.articleId),
          eq(articleEvents.type, e.type),
          e.userId ? eq(articleEvents.userId, e.userId) : isNull(articleEvents.userId),
          gt(articleEvents.at, since),
        ),
      )
      .orderBy(desc(articleEvents.at))
      .limit(1)
    if (last) {
      const prev = (last.payload ?? {}) as Record<string, unknown>
      const next = e.payload ?? {}
      await exec
        .update(articleEvents)
        .set({ payload: e.merge ? e.merge(prev, next) : { ...prev, ...next }, at: new Date() })
        .where(eq(articleEvents.id, last.id))
      return false
    }
  }
  await exec.insert(articleEvents).values({ tenantId: e.tenantId, articleId: e.articleId, type: e.type, userId: e.userId, payload: e.payload ?? null })
  return true
}

export { mergeFieldChanges, mergeDraftEdits, FIELD_EDIT_WINDOW_MS, DRAFT_EDIT_WINDOW_MS } from './provenance-merge'
import { DRAFT_EDIT_WINDOW_MS } from './provenance-merge'

/** The pre-edit draft, saved once per editing session so History can show what changed. */
export async function saveEditCheckpoint(exec: Exec, articleId: string, html: string, userId: string | null): Promise<number> {
  const [row] = await exec.select({ n: max(articleVersions.versionNo) }).from(articleVersions).where(eq(articleVersions.articleId, articleId))
  const versionNo = (row?.n ?? 0) + 1
  await exec
    .insert(articleVersions)
    .values({ articleId, versionNo, html, kind: 'edit_checkpoint', label: 'Before edits', wordCount: countWords(html), createdBy: userId })
  return versionNo
}

/** Events that replace the whole draft, so an editing session can't continue across them. */
export const DRAFT_REPLACING_EVENTS = ['generated', 'revised', 'restored']

/**
 * Is there an open draft-editing session for this person: an edit within the window, with no regenerate,
 * revise or restore since? (If not, a new session starts with its own checkpoint.)
 */
export async function hasOpenDraftSession(exec: Exec, articleId: string, userId: string | null): Promise<boolean> {
  const since = new Date(Date.now() - DRAFT_EDIT_WINDOW_MS)
  const [last] = await exec
    .select({ at: articleEvents.at })
    .from(articleEvents)
    .where(
      and(
        eq(articleEvents.articleId, articleId),
        eq(articleEvents.type, 'draft_edited'),
        userId ? eq(articleEvents.userId, userId) : isNull(articleEvents.userId),
        gt(articleEvents.at, since),
      ),
    )
    .orderBy(desc(articleEvents.at))
    .limit(1)
  if (!last) return false
  const [replaced] = await exec
    .select({ id: articleEvents.id })
    .from(articleEvents)
    .where(and(eq(articleEvents.articleId, articleId), inArray(articleEvents.type, DRAFT_REPLACING_EVENTS), gt(articleEvents.at, last.at)))
    .limit(1)
  return !replaced
}
