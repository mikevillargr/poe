import 'server-only'
import { and, asc, desc, eq, gt, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleEvents, articleVersions, articles, importBatches, users } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { HistoryData } from './history-format'
import { draftDiff } from './draft-diff'

const MAX_EVENTS = 500

/** DR-020: an article's whole life, newest first, with names for everyone involved. */
export async function getArticleHistory(tenantId: string, articleId: string): Promise<HistoryData> {
  const [article] = await db
    .select({ createdAt: articles.createdAt, createdBy: articles.createdBy, sourceRowKey: articles.sourceRowKey, importFilename: importBatches.filename })
    .from(articles)
    .leftJoin(importBatches, eq(importBatches.id, articles.importBatchId))
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId)))
    .limit(1)
  if (!article) throw Errors.notFound('Article')

  const rows = await db
    .select({
      id: articleEvents.id,
      type: articleEvents.type,
      at: articleEvents.at,
      userId: articleEvents.userId,
      userName: users.name,
      userImage: users.image,
      fromStatus: articleEvents.fromStatus,
      toStatus: articleEvents.toStatus,
      payload: articleEvents.payload,
    })
    .from(articleEvents)
    .leftJoin(users, eq(users.id, articleEvents.userId))
    .where(eq(articleEvents.articleId, articleId))
    .orderBy(desc(articleEvents.at), desc(articleEvents.id))
    .limit(MAX_EVENTS)

  // Names for the people an owner change points at, and for the creator.
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.type !== 'assigned') continue
    const p = (r.payload ?? {}) as { from?: unknown; to?: unknown }
    for (const v of [p.from, p.to]) if (typeof v === 'string') ids.add(v)
  }
  if (article.createdBy) ids.add(article.createdBy)
  const named = ids.size ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, [...ids])) : []
  const people = Object.fromEntries(named.map((u) => [u.id, u.name ?? u.email]))

  const sheetRow = article.sourceRowKey ? Number(article.sourceRowKey.split(':').pop()) : null
  return {
    events: rows.map((r) => ({ ...r, at: r.at.toISOString(), payload: (r.payload ?? null) as Record<string, unknown> | null })),
    people,
    origin: {
      createdAt: article.createdAt.toISOString(),
      createdByName: article.createdBy ? (people[article.createdBy] ?? null) : null,
      importFilename: article.importFilename ?? null,
      sheetRow: sheetRow !== null && Number.isFinite(sheetRow) ? sheetRow : null,
    },
  }
}

/** DR-020: the before/after of one draft-editing session (its checkpoint vs. the next version or the current draft). */
export async function getDraftSessionChanges(tenantId: string, articleId: string, eventId: string) {
  const [ev] = await db
    .select({ payload: articleEvents.payload, type: articleEvents.type })
    .from(articleEvents)
    .where(and(eq(articleEvents.id, eventId), eq(articleEvents.articleId, articleId), eq(articleEvents.tenantId, tenantId)))
    .limit(1)
  const checkpoint = Number((ev?.payload as { checkpointVersionNo?: unknown } | null)?.checkpointVersionNo)
  if (!ev || ev.type !== 'draft_edited' || !Number.isInteger(checkpoint)) throw Errors.notFound('Changes')

  const [before] = await db
    .select({ html: articleVersions.html })
    .from(articleVersions)
    .where(and(eq(articleVersions.articleId, articleId), eq(articleVersions.versionNo, checkpoint)))
    .limit(1)
  if (!before) throw Errors.notFound('Changes')
  // The session ends where the next version starts (a later checkpoint, a pre-regenerate snapshot, a save), or now.
  const [next] = await db
    .select({ html: articleVersions.html, versionNo: articleVersions.versionNo })
    .from(articleVersions)
    .where(and(eq(articleVersions.articleId, articleId), gt(articleVersions.versionNo, checkpoint)))
    .orderBy(asc(articleVersions.versionNo))
    .limit(1)
  let afterHtml = next?.html
  if (afterHtml === undefined) {
    const [a] = await db.select({ html: articles.draftHtml }).from(articles).where(eq(articles.id, articleId)).limit(1)
    afterHtml = a?.html ?? ''
  }
  return { hunks: draftDiff(before.html, afterHtml), endsAt: next ? `version ${next.versionNo}` : 'current draft' }
}
