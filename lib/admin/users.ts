import 'server-only'
import { and, asc, count, desc, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { Errors } from '@/lib/api/errors'
import type { AppUser } from '@/lib/auth/guards'

export interface AdminUserDTO {
  id: string
  name: string
  email: string
  image: string | null
  role: 'super_admin' | 'member'
  status: 'pending' | 'active' | 'disabled'
  approvedAt: string | null
  lastLoginAt: string | null
  createdAt: string
}

function toDTO(u: typeof users.$inferSelect): AdminUserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    image: u.image,
    role: u.role,
    status: u.status,
    approvedAt: u.approvedAt?.toISOString() ?? null,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }
}

export async function listUsers(): Promise<AdminUserDTO[]> {
  const rows = await db
    .select()
    .from(users)
    // pending first (newest request first), then everyone else by name
    .orderBy(sql`case when ${users.status} = 'pending' then 0 else 1 end`, desc(users.createdAt), asc(users.name))
  return rows.map(toDTO)
}

export async function pendingCount(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(users).where(eq(users.status, 'pending'))
  return row?.n ?? 0
}

export interface UserChange {
  status?: 'active' | 'disabled'
  role?: 'super_admin' | 'member'
}

/**
 * Approve / deny / disable / re-enable / promote / demote, with guards (DR-008):
 * nobody can demote or disable themselves, and the last active super admin can't be demoted or disabled.
 */
export async function changeUser(actor: AppUser, userId: string, change: UserChange): Promise<AdminUserDTO> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw Errors.notFound('User')
  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(users).where(eq(users.id, userId)).for('update').limit(1)
    if (!target) throw Errors.notFound('User')

    const demoting = change.role === 'member' && target.role === 'super_admin'
    const disabling = change.status === 'disabled' && target.status !== 'disabled'
    if (target.id === actor.id && (demoting || disabling)) {
      throw Errors.conflict('You can’t demote or disable your own account.')
    }
    if (target.role === 'super_admin' && (demoting || disabling)) {
      const [other] = await tx
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.role, 'super_admin'), eq(users.status, 'active'), ne(users.id, target.id)))
      if (!other || other.n === 0) throw Errors.conflict('Poe needs at least one active super admin.')
    }
    if (change.role === 'super_admin' && target.status !== 'active' && change.status !== 'active') {
      throw Errors.conflict('Approve or re-enable this person before making them a super admin.')
    }

    const set: Partial<typeof users.$inferInsert> = {}
    if (change.role) set.role = change.role
    if (change.status) {
      set.status = change.status
      if (change.status === 'active' && target.status === 'pending') {
        set.approvedBy = actor.id
        set.approvedAt = new Date()
      }
    }
    if (!Object.keys(set).length) return toDTO(target)
    const [updated] = await tx.update(users).set(set).where(eq(users.id, userId)).returning()
    return toDTO(updated)
  })
}
