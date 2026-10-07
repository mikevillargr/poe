import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleEvents, articles } from '@/lib/db/schema'
import type { AppUser } from '@/lib/auth/guards'

/**
 * DR-019: an article with no owner becomes owned by whoever starts its research, draft or batch run. A manually
 * set owner is never changed. Records an `assigned` event when it happens. Returns true when it assigned.
 */
export async function claimOwnerIfUnassigned(tenantId: string, articleId: string, user: Pick<AppUser, 'id'>): Promise<boolean> {
  const rows = await db
    .update(articles)
    .set({ assigneeId: user.id })
    .where(and(eq(articles.id, articleId), eq(articles.tenantId, tenantId), isNull(articles.assigneeId)))
    .returning({ id: articles.id })
  if (!rows.length) return false
  await db.insert(articleEvents).values({ articleId, tenantId, type: 'assigned', userId: user.id, payload: { from: null, to: user.id, reason: 'started generation' } })
  return true
}
