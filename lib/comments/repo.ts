import 'server-only'
import { createHash } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { articleEvents, shareComments, users, type CommentAnchor } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import { recordArticleEvent } from '@/lib/articles/provenance'
import { articleWatchers, notify } from '@/lib/notifications/notify'

// DR-021: comments on shared articles, from guests (name, optional email) and staff, as threads: a top-level
// comment (on a passage or the whole article) plus replies. Staff resolve and reopen threads.

export interface CommentDTO {
  id: string
  author: { kind: 'guest' | 'staff'; name: string; image: string | null }
  body: string
  createdAt: string
  editedAt: string | null
  /** The viewing guest wrote this (they may edit or delete it). */
  mine: boolean
}

export interface ThreadDTO extends CommentDTO {
  anchor: CommentAnchor | null
  status: 'open' | 'resolved'
  resolvedBy: string | null
  resolvedAt: string | null
  replies: CommentDTO[]
}

export type Decision = { decision: 'approved' | 'changes_requested'; name: string; note: string | null; at: string }

export const hashGuestKey = (key: string) => createHash('sha256').update(key).digest('hex')

type Row = typeof shareComments.$inferSelect & { staffName: string | null; staffImage: string | null }

function toDTO(r: Row, guestKeyHash: string | null): CommentDTO {
  return {
    id: r.id,
    author: r.authorUserId
      ? { kind: 'staff', name: r.staffName ?? 'Team member', image: r.staffImage }
      : { kind: 'guest', name: r.guestName ?? 'Guest', image: null },
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    editedAt: r.editedAt?.toISOString() ?? null,
    mine: !!guestKeyHash && r.guestKeyHash === guestKeyHash,
  }
}

export async function listThreads(articleId: string, opts: { guestKey?: string | null } = {}): Promise<ThreadDTO[]> {
  const keyHash = opts.guestKey ? hashGuestKey(opts.guestKey) : null
  const rows = await db
    .select({ c: shareComments, staffName: users.name, staffImage: users.image })
    .from(shareComments)
    .leftJoin(users, eq(users.id, shareComments.authorUserId))
    .where(and(eq(shareComments.articleId, articleId), isNull(shareComments.deletedAt)))
    .orderBy(asc(shareComments.createdAt))
  const resolverIds = [...new Set(rows.map((r) => r.c.resolvedBy).filter(Boolean))] as string[]
  const resolvers = resolverIds.length ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, resolverIds)) : []
  const flat = rows.map((r) => ({ ...r.c, staffName: r.staffName, staffImage: r.staffImage }))
  const threads: ThreadDTO[] = []
  for (const r of flat) {
    if (r.parentId) continue
    threads.push({
      ...toDTO(r, keyHash),
      anchor: r.anchor ?? null,
      status: r.status === 'resolved' ? 'resolved' : 'open',
      resolvedBy: resolvers.find((u) => u.id === r.resolvedBy)?.name ?? null,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      replies: flat.filter((x) => x.parentId === r.id).map((x) => toDTO(x, keyHash)),
    })
  }
  return threads.reverse() // newest thread first
}

export async function openThreadCount(articleId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(shareComments)
    .where(and(eq(shareComments.articleId, articleId), isNull(shareComments.parentId), isNull(shareComments.deletedAt), eq(shareComments.status, 'open')))
  return row?.n ?? 0
}

export type CommentAuthor = { userId: string } | { guestName: string; guestEmail: string | null; guestKey: string }

export async function addComment(input: {
  tenantId: string
  articleId: string
  shareId: string | null
  parentId?: string | null
  author: CommentAuthor
  body: string
  anchor?: CommentAnchor | null
}): Promise<{ id: string }> {
  let parent: typeof shareComments.$inferSelect | undefined
  if (input.parentId) {
    ;[parent] = await db
      .select()
      .from(shareComments)
      .where(and(eq(shareComments.id, input.parentId), eq(shareComments.articleId, input.articleId), isNull(shareComments.deletedAt)))
      .limit(1)
    if (!parent || parent.parentId) throw Errors.notFound('Comment')
  }
  const staff = 'userId' in input.author ? input.author.userId : null
  const guest = 'guestName' in input.author ? input.author : null
  const [row] = await db
    .insert(shareComments)
    .values({
      tenantId: input.tenantId,
      articleId: input.articleId,
      shareId: input.shareId,
      parentId: parent?.id ?? null,
      authorUserId: staff,
      guestName: guest?.guestName ?? null,
      guestEmail: guest?.guestEmail ?? null,
      guestKeyHash: guest ? hashGuestKey(guest.guestKey) : null,
      body: input.body,
      anchor: parent ? null : (input.anchor ?? null),
    })
    .returning({ id: shareComments.id })
  // A reply on a resolved thread reopens it.
  if (parent && parent.status === 'resolved') {
    await db.update(shareComments).set({ status: 'open', resolvedBy: null, resolvedAt: null }).where(eq(shareComments.id, parent.id))
  }

  const name = guest?.guestName ?? (await staffName(staff))
  const type = parent ? 'comment_reply' : 'comment_added'
  await recordArticleEvent(db, {
    tenantId: input.tenantId,
    articleId: input.articleId,
    userId: staff,
    type,
    payload: { name, guest: !!guest, commentId: parent?.id ?? row!.id, quote: (parent?.anchor ?? input.anchor)?.quote?.slice(0, 160) ?? null },
  })
  // The owner hears about it, plus staff already in the thread.
  const watchers = await articleWatchers(input.articleId)
  const participants = parent
    ? (
        await db
          .select({ id: shareComments.authorUserId })
          .from(shareComments)
          .where(and(eq(shareComments.parentId, parent.id)))
      )
        .map((r) => r.id)
        .concat(parent.authorUserId ? [parent.authorUserId] : [])
        .filter((x): x is string => !!x)
    : []
  await notify({
    userIds: [...watchers, ...participants],
    actorUserId: staff,
    type,
    tenantId: input.tenantId,
    articleId: input.articleId,
    payload: { name, commentId: parent?.id ?? row!.id, excerpt: input.body.slice(0, 140) },
  })
  return row!
}

async function staffName(id: string | null) {
  if (!id) return 'Someone'
  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, id)).limit(1)
  return u?.name ?? 'Someone'
}

async function guestOwned(articleId: string, id: string, guestKey: string) {
  const [row] = await db
    .select({ id: shareComments.id })
    .from(shareComments)
    .where(
      and(eq(shareComments.id, id), eq(shareComments.articleId, articleId), eq(shareComments.guestKeyHash, hashGuestKey(guestKey)), isNull(shareComments.deletedAt)),
    )
    .limit(1)
  if (!row) throw Errors.notFound('Comment')
}

export async function guestEditComment(articleId: string, id: string, guestKey: string, body: string) {
  await guestOwned(articleId, id, guestKey)
  await db.update(shareComments).set({ body, editedAt: new Date() }).where(eq(shareComments.id, id))
}

export async function guestDeleteComment(articleId: string, id: string, guestKey: string) {
  await guestOwned(articleId, id, guestKey)
  await db.update(shareComments).set({ deletedAt: new Date() }).where(eq(shareComments.id, id))
}

export async function setThreadStatus(tenantId: string, articleId: string, id: string, status: 'open' | 'resolved', userId: string) {
  const [row] = await db
    .update(shareComments)
    .set(status === 'resolved' ? { status, resolvedBy: userId, resolvedAt: new Date() } : { status, resolvedBy: null, resolvedAt: null })
    .where(and(eq(shareComments.id, id), eq(shareComments.articleId, articleId), eq(shareComments.tenantId, tenantId), isNull(shareComments.parentId)))
    .returning({ id: shareComments.id, guestName: shareComments.guestName, anchor: shareComments.anchor })
  if (!row) throw Errors.notFound('Comment')
  await recordArticleEvent(db, {
    tenantId,
    articleId,
    userId,
    type: status === 'resolved' ? 'comment_resolved' : 'comment_reopened',
    payload: { commentId: id, by: row.guestName, quote: row.anchor?.quote?.slice(0, 160) ?? null },
  })
}

/** A guest's sign-off (or request for changes): recorded in History, and the owner is notified. */
export async function recordDecision(input: { tenantId: string; articleId: string; decision: Decision['decision']; name: string; note: string | null }) {
  const type = input.decision === 'approved' ? 'client_approved' : 'changes_requested'
  await recordArticleEvent(db, { tenantId: input.tenantId, articleId: input.articleId, userId: null, type, payload: { name: input.name, note: input.note } })
  await notify({
    userIds: await articleWatchers(input.articleId),
    type,
    tenantId: input.tenantId,
    articleId: input.articleId,
    payload: { name: input.name, note: input.note },
  })
}

export async function latestDecision(articleId: string): Promise<Decision | null> {
  const [row] = await db
    .select({ type: articleEvents.type, payload: articleEvents.payload, at: articleEvents.at })
    .from(articleEvents)
    .where(and(eq(articleEvents.articleId, articleId), inArray(articleEvents.type, ['client_approved', 'changes_requested'])))
    .orderBy(desc(articleEvents.at))
    .limit(1)
  if (!row) return null
  const p = (row.payload ?? {}) as { name?: string; note?: string | null }
  return { decision: row.type === 'client_approved' ? 'approved' : 'changes_requested', name: p.name ?? 'Someone', note: p.note ?? null, at: row.at.toISOString() }
}
