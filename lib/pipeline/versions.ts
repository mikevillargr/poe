import 'server-only'
import { recordArticleEvent } from '@/lib/articles/provenance'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleVersions, users } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'
import { createVersion, getArticle, updateArticle, type Article } from '@/lib/articles/repo'
import { countWords } from '@/lib/articles/text'
import type { ArticleVersionDTO, ArticleVersionWithHtml } from './schemas'

type VersionRow = typeof articleVersions.$inferSelect

function toDTO(v: VersionRow, createdByName: string | null): ArticleVersionDTO {
  return {
    id: v.id,
    versionNo: v.versionNo,
    kind: v.kind,
    label: v.label,
    wordCount: v.wordCount,
    createdBy: v.createdBy,
    createdByName,
    createdAt: v.createdAt.toISOString(),
  }
}

/** Newest first, without the HTML bodies. */
export async function listVersions(articleId: string): Promise<ArticleVersionDTO[]> {
  const rows = await db
    .select({ v: articleVersions, name: users.name })
    .from(articleVersions)
    .leftJoin(users, eq(users.id, articleVersions.createdBy))
    .where(eq(articleVersions.articleId, articleId))
    .orderBy(desc(articleVersions.versionNo))
  return rows.map((r) => toDTO(r.v, r.name))
}

export async function getVersion(articleId: string, versionNo: number): Promise<ArticleVersionWithHtml> {
  const [row] = await db
    .select({ v: articleVersions, name: users.name })
    .from(articleVersions)
    .leftJoin(users, eq(users.id, articleVersions.createdBy))
    .where(and(eq(articleVersions.articleId, articleId), eq(articleVersions.versionNo, versionNo)))
    .limit(1)
  if (!row) throw Errors.notFound('Version')
  return { ...toDTO(row.v, row.name), html: row.v.html }
}

function hasContent(html: string | null | undefined): html is string {
  return !!html && countWords(html) > 0
}

/**
 * Saves the current draft as a `manual` version before it gets overwritten (regenerate, restore),
 * so nothing is ever lost. Empty drafts are skipped. Returns the new version, or null.
 */
export async function snapshotDraft(article: Article, user: AppUser | null, label: string) {
  if (!hasContent(article.draftHtml)) return null
  return createVersion(article.id, article.draftHtml, 'manual', user, label)
}

/** POST …/versions: explicit "Save version" of the current draft. */
export async function saveManualVersion(tenantId: string, articleId: string, user: AppUser, label?: string) {
  const article = await getArticle(tenantId, articleId)
  if (!hasContent(article.draftHtml)) throw Errors.badRequest('There is no draft to save yet.')
  const v = await createVersion(articleId, article.draftHtml, 'manual', user, label || undefined)
  await recordArticleEvent(db, { tenantId, articleId, userId: user.id, type: 'version_saved', payload: { versionNo: v.versionNo, label: label || null, wordCount: v.wordCount } })
  return toDTO(v, user.name)
}

/**
 * POST …/versions/[n]/restore: snapshot the current draft, then make version n the draft again and
 * record that as a `restore` version.
 */
export async function restoreVersion(tenantId: string, articleId: string, versionNo: number, user: AppUser) {
  const article = await getArticle(tenantId, articleId)
  const target = await getVersion(articleId, versionNo)
  const snapshot =
    article.draftHtml !== target.html ? await snapshotDraft(article, user, `Before restoring v${versionNo}`) : null
  const restored = await createVersion(articleId, target.html, 'restore', user, `Restored v${versionNo}`)
  const updated = await updateArticle(tenantId, articleId, { draftHtml: target.html }, user, {
    eventType: 'restored',
    eventPayload: { fromVersionNo: versionNo, versionNo: restored.versionNo, snapshotVersionNo: snapshot?.versionNo ?? null },
  })
  return { article: updated, version: toDTO(restored, user.name), snapshot: snapshot ? toDTO(snapshot, user.name) : null }
}
