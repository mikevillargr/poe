import 'server-only'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articles, notifications, tenants, users } from '@/lib/db/schema'
import { getSender } from './email'
import { notificationText, type NotificationType } from './format'

// DR-021: in-app notifications, written as an outbox (email_status) so email can be added without a schema change.

export interface NotifyInput {
  userIds: string[]
  /** Never notify the person who did it. */
  actorUserId?: string | null
  type: NotificationType
  tenantId: string
  articleId: string
  payload: Record<string, unknown>
}

export async function notify(n: NotifyInput) {
  const ids = [...new Set(n.userIds)].filter((id) => id && id !== n.actorUserId)
  if (!ids.length) return
  const rows = await db
    .insert(notifications)
    .values(ids.map((userId) => ({ userId, tenantId: n.tenantId, articleId: n.articleId, type: n.type, payload: n.payload, emailStatus: 'pending' })))
    .returning({ id: notifications.id, userId: notifications.userId })
  await dispatchEmail(rows, n).catch((err) => console.error('[notify] email dispatch failed', err))
}

async function dispatchEmail(rows: { id: string; userId: string }[], n: NotifyInput) {
  const sender = getSender()
  const [recipients, [ctx]] = await Promise.all([
    db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(inArray(users.id, rows.map((r) => r.userId))),
    db
      .select({ title: articles.title, slug: tenants.slug })
      .from(articles)
      .innerJoin(tenants, eq(tenants.id, articles.tenantId))
      .where(eq(articles.id, n.articleId))
      .limit(1),
  ])
  const base = (process.env.AUTH_URL ?? '').replace(/\/+$/, '')
  for (const r of rows) {
    const to = recipients.find((u) => u.id === r.userId)
    if (!to || !ctx) continue
    const text = notificationText(n.type, n.payload, ctx.title)
    const status = await sender.send({
      notificationId: r.id,
      to: { email: to.email, name: to.name },
      subject: text,
      text,
      link: `${base}/c/${ctx.slug}/articles/${n.articleId}`,
    })
    await db
      .update(notifications)
      .set({ emailStatus: status, emailedAt: status === 'sent' ? new Date() : null })
      .where(eq(notifications.id, r.id))
  }
}

/** Who hears about activity on an article: its owner (or its creator when unassigned). */
export async function articleWatchers(articleId: string): Promise<string[]> {
  const [a] = await db.select({ owner: articles.assigneeId, creator: articles.createdBy }).from(articles).where(eq(articles.id, articleId)).limit(1)
  const id = a?.owner ?? a?.creator
  return id ? [id] : []
}

export interface NotificationDTO {
  id: string
  type: string
  text: string
  href: string | null
  read: boolean
  createdAt: string
}

export async function listNotifications(userId: string, limit = 30): Promise<{ items: NotificationDTO[]; unread: number }> {
  const [rows, [{ unread }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        type: notifications.type,
        payload: notifications.payload,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        articleId: notifications.articleId,
        title: articles.title,
        slug: tenants.slug,
      })
      .from(notifications)
      .leftJoin(articles, eq(articles.id, notifications.articleId))
      .leftJoin(tenants, eq(tenants.id, notifications.tenantId))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit),
    db
      .select({ unread: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ])
  return {
    unread,
    items: rows.map((r) => ({
      id: r.id,
      type: r.type,
      text: notificationText(r.type as NotificationType, r.payload ?? {}, r.title ?? 'an article'),
      href: r.slug && r.articleId ? `/c/${r.slug}/articles/${r.articleId}${r.type === 'comment_added' || r.type === 'comment_reply' ? '?panel=comments' : ''}` : null,
      read: !!r.readAt,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function markNotificationsRead(userId: string, ids: string[] | 'all') {
  const where = ids === 'all' ? eq(notifications.userId, userId) : and(eq(notifications.userId, userId), inArray(notifications.id, ids))
  await db.update(notifications).set({ readAt: new Date() }).where(and(where, isNull(notifications.readAt)))
}
