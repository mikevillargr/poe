import 'server-only'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleExports, articles, shareComments, tenants, users } from '@/lib/db/schema'
import { createGoogleDoc, shareWithLink } from '@/lib/google/drive'
import { buildExportDocument } from '@/lib/export/document'
import { recordArticleEvent } from '@/lib/articles/provenance'
import { getOrCreateShare } from '@/lib/shares/repo'
import { latestDecision } from '@/lib/comments/repo'
import { ARTICLE_STATUS_LABELS, type ArticleStatus } from '@/lib/articles/schemas'
import { draftHash, type ExportRow } from './table'

// DR-021: bulk export from Home: Poe preview links and/or Google Docs (reused while a draft is unchanged).

export interface ExportArticle {
  id: string
  title: string
  status: string
  draftHtml: string | null
  row: ExportRow
}

export async function loadExportArticles(tenantId: string, ids: string[]): Promise<{ clientName: string; items: ExportArticle[] }> {
  const [client] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1)
  const rows = await db
    .select({ a: articles, owner: users.name })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.assigneeId))
    .where(and(eq(articles.tenantId, tenantId), inArray(articles.id, ids)))
  const open = await db
    .select({ articleId: shareComments.articleId, n: sql<number>`count(*)::int` })
    .from(shareComments)
    .where(and(inArray(shareComments.articleId, ids), isNull(shareComments.parentId), isNull(shareComments.deletedAt), eq(shareComments.status, 'open')))
    .groupBy(shareComments.articleId)
  const byId = new Map(rows.map((r) => [r.a.id, r]))
  const items: ExportArticle[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) continue
    const decision = await latestDecision(id)
    const score = r.a.lastOptimize?.overallScore
    items.push({
      id,
      title: r.a.title,
      status: r.a.status,
      draftHtml: r.a.draftHtml,
      row: {
        title: r.a.title,
        status: ARTICLE_STATUS_LABELS[r.a.status as ArticleStatus] ?? r.a.status,
        primaryKeyword: r.a.primaryKeyword,
        keywords: r.a.keywords ?? [],
        words: r.a.wordCount ?? 0,
        targetWords: r.a.targetWordCount,
        score: typeof score === 'number' ? Math.round(score) : null,
        owner: r.owner,
        poeLink: null,
        docLink: null,
        openComments: open.find((o) => o.articleId === id)?.n ?? 0,
        decision: decision ? `${decision.decision === 'approved' ? 'Approved' : 'Changes requested'} by ${decision.name}` : null,
        updatedAt: r.a.updatedAt.toISOString(),
      },
    })
  }
  return { clientName: client?.name ?? 'Articles', items }
}

export async function poeLink(tenantId: string, articleId: string, userId: string, origin: string): Promise<string> {
  const share = await getOrCreateShare(tenantId, articleId, userId)
  return `${origin}/s/${share.token}`
}

/** The article's Google Doc: reused while title and draft are unchanged, otherwise a new one. */
export async function googleDocFor(
  tenantId: string,
  a: ExportArticle,
  userId: string,
  opts: { linkSharing: boolean },
): Promise<{ url: string; reused: boolean; shared: boolean | null } | null> {
  if (!a.draftHtml?.trim()) return null
  const hash = draftHash(a.title, a.draftHtml)
  const [prev] = await db
    .select({ url: articleExports.url })
    .from(articleExports)
    .where(and(eq(articleExports.articleId, a.id), eq(articleExports.kind, 'google_doc'), eq(articleExports.draftHash, hash), eq(articleExports.createdBy, userId)))
    .orderBy(desc(articleExports.createdAt))
    .limit(1)
  const share = async (url: string) => (opts.linkSharing ? await shareWithLink(userId, url).catch(() => false) : null)
  if (prev) return { url: prev.url, reused: true, shared: await share(prev.url) }
  const url = await createGoogleDoc(userId, a.title, buildExportDocument(a.title, a.draftHtml))
  await db.insert(articleExports).values({ articleId: a.id, kind: 'google_doc', url, draftHash: hash, createdBy: userId })
  await recordArticleEvent(db, { tenantId, articleId: a.id, userId, type: 'exported', payload: { format: 'google-doc', url, bulk: true } })
  return { url, reused: false, shared: await share(url) }
}

/** Runs `fn` over items with at most `limit` in flight. */
export async function eachLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!)
    }),
  )
}
