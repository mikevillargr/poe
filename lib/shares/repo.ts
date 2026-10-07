import 'server-only'
import { randomBytes } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleShares } from '@/lib/db/schema'
import { recordArticleEvent } from '@/lib/articles/provenance'

// DR-021: one living share link per article. Reset revokes the current token and issues a new one.

export type ShareRow = typeof articleShares.$inferSelect

export interface ShareDTO {
  token: string
  path: string
  showComments: boolean
  showRules: boolean
  showHistory: boolean
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
}

export function newShareToken(): string {
  return randomBytes(24).toString('base64url')
}

export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32}$/

export function toShareDTO(s: ShareRow): ShareDTO {
  return {
    token: s.token,
    path: `/s/${s.token}`,
    showComments: s.showComments,
    showRules: s.showRules,
    showHistory: s.showHistory,
    viewCount: s.viewCount,
    lastViewedAt: s.lastViewedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }
}

export async function getActiveShare(tenantId: string, articleId: string): Promise<ShareRow | null> {
  const [row] = await db
    .select()
    .from(articleShares)
    .where(and(eq(articleShares.tenantId, tenantId), eq(articleShares.articleId, articleId), isNull(articleShares.revokedAt)))
    .limit(1)
  return row ?? null
}

/** The article's link, created (and logged in History) on first use. */
export async function getOrCreateShare(tenantId: string, articleId: string, userId: string): Promise<ShareRow> {
  const existing = await getActiveShare(tenantId, articleId)
  if (existing) return existing
  const [row] = await db
    .insert(articleShares)
    .values({ tenantId, articleId, token: newShareToken(), createdBy: userId })
    .onConflictDoNothing()
    .returning()
  if (!row) return (await getActiveShare(tenantId, articleId))! // created concurrently
  await recordArticleEvent(db, { tenantId, articleId, userId, type: 'shared', payload: { action: 'created' } })
  return row
}

export async function updateShareSettings(
  tenantId: string,
  articleId: string,
  patch: Partial<Pick<ShareRow, 'showComments' | 'showRules' | 'showHistory'>>,
): Promise<ShareRow | null> {
  const [row] = await db
    .update(articleShares)
    .set(patch)
    .where(and(eq(articleShares.tenantId, tenantId), eq(articleShares.articleId, articleId), isNull(articleShares.revokedAt)))
    .returning()
  return row ?? null
}

/** Revokes the current link; with `reissue`, creates a new one with the same settings. */
export async function revokeShare(tenantId: string, articleId: string, userId: string, reissue = false): Promise<ShareRow | null> {
  return db.transaction(async (tx) => {
    const [old] = await tx
      .update(articleShares)
      .set({ revokedAt: new Date() })
      .where(and(eq(articleShares.tenantId, tenantId), eq(articleShares.articleId, articleId), isNull(articleShares.revokedAt)))
      .returning()
    let next: ShareRow | null = null
    if (reissue) {
      ;[next] = await tx
        .insert(articleShares)
        .values({
          tenantId,
          articleId,
          token: newShareToken(),
          createdBy: userId,
          showComments: old?.showComments ?? true,
          showRules: old?.showRules ?? true,
          showHistory: old?.showHistory ?? true,
        })
        .returning()
    }
    if (old || next) await recordArticleEvent(tx, { tenantId, articleId, userId, type: 'shared', payload: { action: reissue ? 'reset' : 'revoked' } })
    return next
  })
}

/** An active share by token, or null (unknown, malformed or revoked). */
export async function resolveShareToken(token: string): Promise<ShareRow | null> {
  if (!SHARE_TOKEN_RE.test(token)) return null
  const [row] = await db
    .select()
    .from(articleShares)
    .where(and(eq(articleShares.token, token), isNull(articleShares.revokedAt)))
    .limit(1)
  return row ?? null
}

export async function countShareView(shareId: string) {
  await db
    .update(articleShares)
    .set({ viewCount: sql`${articleShares.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(articleShares.id, shareId))
}
