import 'server-only'
import { and, asc, count, desc, eq, ilike, inArray, max, or, sql } from 'drizzle-orm'
import { db, type Db } from '@/lib/db'
import { articleEvents, articleVersions, articles, users } from '@/lib/db/schema'
import type { ArticleVersionKind } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import {
  ARTICLE_STATUSES,
  canTransition,
  type ArticleEventDTO,
  type ArticleInputParsed,
  type ArticleStatus,
  type ArticleSummary,
  type StatusCounts,
} from './schemas'
import { countWords } from './text'

export type Article = typeof articles.$inferSelect
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

const GAP = 1024

function toSummary(a: Article): ArticleSummary {
  return {
    id: a.id,
    title: a.title,
    status: a.status,
    position: a.position,
    primaryKeyword: a.primaryKeyword,
    keywords: a.keywords,
    targetWordCount: a.targetWordCount,
    wordCount: a.wordCount,
    researchStatus: a.researchStatus,
    assigneeId: a.assigneeId,
    statusChangedAt: a.statusChangedAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    templateId: a.templateId,
    generationStatus: a.generationStatus,
    needsReview: !!a.generationMeta?.needsReview,
  }
}

export async function listArticles(
  tenantId: string,
  opts: { status?: ArticleStatus; q?: string } = {},
): Promise<ArticleSummary[]> {
  const conds = [eq(articles.tenantId, tenantId)]
  if (opts.status) conds.push(eq(articles.status, opts.status))
  if (opts.q?.trim()) {
    const like = `%${opts.q.trim()}%`
    conds.push(or(ilike(articles.title, like), sql`array_to_string(${articles.keywords}, ' ') ilike ${like}`)!)
  }
  const rows = await db.select().from(articles).where(and(...conds)).orderBy(asc(articles.position))
  return rows.map(toSummary)
}

export async function statusCounts(tenantId: string): Promise<StatusCounts> {
  const rows = await db
    .select({ status: articles.status, n: count() })
    .from(articles)
    .where(eq(articles.tenantId, tenantId))
    .groupBy(articles.status)
  const out = Object.fromEntries(ARTICLE_STATUSES.map((s) => [s, 0])) as StatusCounts
  for (const r of rows) out[r.status] = r.n
  return out
}

export async function getArticle(tenantId: string, articleId: string): Promise<Article> {
  if (!/^[0-9a-f-]{36}$/i.test(articleId)) throw Errors.notFound('Article')
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
    .limit(1)
  if (!row) throw Errors.notFound('Article')
  return row
}

async function nextPosition(tx: Tx | Db, tenantId: string): Promise<number> {
  const [row] = await tx.select({ p: max(articles.position) }).from(articles).where(eq(articles.tenantId, tenantId))
  return (row?.p ?? 0) + GAP
}

function normalizeInput(input: ArticleInputParsed) {
  const keywords = input.keywords ?? []
  return {
    title: input.title,
    brief: input.brief ?? null,
    keywords,
    primaryKeyword: input.primaryKeyword || keywords[0] || null,
    targetWordCount: input.targetWordCount ?? null,
  }
}

/** Appends articles to the end of the client's queue, in order, in one transaction. */
export async function appendArticles(
  tenantId: string,
  inputs: ArticleInputParsed[],
  user: AppUser,
  opts: { importBatchId?: string } = {},
): Promise<Article[]> {
  if (!inputs.length) return []
  return db.transaction(async (tx) => {
    let pos = await nextPosition(tx, tenantId)
    const created = await tx
      .insert(articles)
      .values(
        inputs.map((i) => {
          const row = {
            ...normalizeInput(i),
            tenantId,
            position: pos,
            importBatchId: opts.importBatchId ?? null,
            createdBy: user.id,
            updatedBy: user.id,
          }
          pos += GAP
          return row
        }),
      )
      .returning()
    await tx.insert(articleEvents).values(
      created.map((a) => ({
        articleId: a.id,
        tenantId,
        type: opts.importBatchId ? 'imported' : 'created',
        toStatus: a.status,
        payload: opts.importBatchId ? { importBatchId: opts.importBatchId } : null,
        userId: user.id,
      })),
    )
    return created
  })
}

export async function createArticle(tenantId: string, input: ArticleInputParsed, user: AppUser) {
  const [a] = await appendArticles(tenantId, [input], user)
  return a
}

export interface ArticleUpdate {
  title?: string
  brief?: string | null
  keywords?: string[]
  primaryKeyword?: string | null
  targetWordCount?: number | null
  status?: ArticleStatus
  draftHtml?: string | null
  research?: Article['research']
  assigneeId?: string | null
}

/**
 * Applies a patch. Manual status changes must be one step (canTransition) unless `force` is set
 * (used by the pipeline for queued → draft after generation). Logs status changes as events.
 */
export async function updateArticle(
  tenantId: string,
  articleId: string,
  patch: ArticleUpdate,
  user: AppUser | null,
  opts: { force?: boolean; eventType?: string; eventPayload?: Record<string, unknown> } = {},
): Promise<Article> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(articles)
      .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
      .for('update')
      .limit(1)
    if (!current) throw Errors.notFound('Article')

    const set: Partial<typeof articles.$inferInsert> = { updatedAt: new Date(), updatedBy: user?.id ?? null }
    for (const k of ['title', 'brief', 'keywords', 'primaryKeyword', 'targetWordCount', 'research', 'assigneeId'] as const) {
      if (patch[k] !== undefined) (set as Record<string, unknown>)[k] = patch[k]
    }
    if (patch.draftHtml !== undefined) {
      set.draftHtml = patch.draftHtml
      set.wordCount = countWords(patch.draftHtml)
    }

    const statusChanged = patch.status !== undefined && patch.status !== current.status
    if (statusChanged) {
      if (!opts.force && !canTransition(current.status, patch.status!)) {
        throw Errors.badRequest(`Can't move an article from ${current.status} to ${patch.status}.`)
      }
      set.status = patch.status
      set.statusChangedAt = new Date()
    }

    const [updated] = await tx.update(articles).set(set).where(eq(articles.id, articleId)).returning()

    if (statusChanged || opts.eventType) {
      await tx.insert(articleEvents).values({
        articleId,
        tenantId,
        type: opts.eventType ?? 'status_changed',
        fromStatus: statusChanged ? current.status : null,
        toStatus: statusChanged ? patch.status! : null,
        payload: opts.eventPayload ?? null,
        userId: user?.id ?? null,
      })
    }
    return updated
  })
}

export async function deleteArticle(tenantId: string, articleId: string) {
  const res = await db
    .delete(articles)
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
    .returning({ id: articles.id })
  if (!res.length) throw Errors.notFound('Article')
}

/** Moves an article between two neighbours (either may be null). Renumbers if the gap runs out. */
export async function reorderArticle(
  tenantId: string,
  articleId: string,
  beforeId: string | null | undefined,
  afterId: string | null | undefined,
) {
  return db.transaction(async (tx) => {
    const ids = [articleId, beforeId, afterId].filter(Boolean) as string[]
    const rows = await tx
      .select({ id: articles.id, position: articles.position })
      .from(articles)
      .where(and(eq(articles.tenantId, tenantId), inArray(articles.id, ids)))
    const pos = new Map(rows.map((r) => [r.id, r.position]))
    if (!pos.has(articleId) || (beforeId && !pos.has(beforeId)) || (afterId && !pos.has(afterId))) {
      throw Errors.notFound('Article')
    }

    const lo = beforeId ? pos.get(beforeId)! : null
    const hi = afterId ? pos.get(afterId)! : null
    let next: number
    if (lo !== null && hi !== null) next = (lo + hi) / 2
    else if (lo !== null) next = lo + GAP
    else if (hi !== null) next = hi - GAP
    else return

    if (lo !== null && hi !== null && Math.abs(hi - lo) < 1e-6) {
      // Gap exhausted: renumber the whole queue, then retry the midpoint.
      const all = await tx
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.tenantId, tenantId))
        .orderBy(asc(articles.position))
      for (const [i, r] of all.entries()) {
        await tx.update(articles).set({ position: (i + 1) * GAP }).where(eq(articles.id, r.id))
      }
      const fresh = new Map(all.map((r, i) => [r.id, (i + 1) * GAP]))
      next = (fresh.get(beforeId!)! + fresh.get(afterId!)!) / 2
    }
    await tx.update(articles).set({ position: next }).where(eq(articles.id, articleId))
  })
}

export async function createVersion(
  articleId: string,
  html: string,
  kind: ArticleVersionKind,
  user: AppUser | null,
  label?: string,
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ n: max(articleVersions.versionNo) })
      .from(articleVersions)
      .where(eq(articleVersions.articleId, articleId))
    const versionNo = (row?.n ?? 0) + 1
    const [v] = await tx
      .insert(articleVersions)
      .values({ articleId, versionNo, html, kind, label: label ?? null, wordCount: countWords(html), createdBy: user?.id ?? null })
      .returning()
    return v
  })
}

export interface ActivityPage {
  events: ArticleEventDTO[]
  /** Id of the oldest returned event; pass as `before` for the next page. Null when exhausted. */
  nextCursor: string | null
}

export async function recentEvents(tenantId: string, limit = 20, before?: string): Promise<ActivityPage> {
  const pageSize = Math.min(limit, 100)
  const conds = [eq(articleEvents.tenantId, tenantId)]
  if (before) {
    // Row-value cursor against a subquery: keeps the comparison entirely in Postgres, so no
    // JS Date/uuid serialization edge cases (timestamp ties need the id tiebreak).
    conds.push(
      sql`(${articleEvents.at}, ${articleEvents.id}) < (select c.at, c.id from ${articleEvents} as c where c.id = ${before} and c.tenant_id = ${tenantId})`,
    )
  }
  const rows = await db
    .select({
      id: articleEvents.id,
      articleId: articleEvents.articleId,
      articleTitle: articles.title,
      type: articleEvents.type,
      fromStatus: articleEvents.fromStatus,
      toStatus: articleEvents.toStatus,
      userName: users.name,
      userImage: users.image,
      at: articleEvents.at,
    })
    .from(articleEvents)
    .innerJoin(articles, eq(articles.id, articleEvents.articleId))
    .leftJoin(users, eq(users.id, articleEvents.userId))
    .where(and(...conds))
    .orderBy(desc(articleEvents.at), desc(articleEvents.id))
    .limit(pageSize)
  return {
    events: rows.map((r) => ({ ...r, at: r.at.toISOString() })),
    nextCursor: rows.length === pageSize ? rows[rows.length - 1]!.id : null,
  }
}

export { toSummary }
