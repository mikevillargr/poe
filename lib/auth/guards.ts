import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { ApiError, Errors, errorResponse } from '@/lib/api/errors'

export type AppUser = typeof users.$inferSelect

// Session → current DB row. Status is read from the DB on every request (not from the JWT), so
// approving or disabling a user takes effect immediately.
export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  return row ?? null
}

/** API guard: throws ApiError (401/403) unless the user is signed in and active. */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) throw Errors.unauthenticated()
  if (user.status === 'pending') throw Errors.pending()
  if (user.status === 'disabled') throw Errors.disabled()
  return user
}

export async function requireSuperAdmin(): Promise<AppUser> {
  const user = await requireUser()
  if (user.role !== 'super_admin') throw Errors.forbidden()
  return user
}

/** Page guard for server components: redirects instead of throwing. */
export async function requirePageUser(opts: { admin?: boolean } = {}): Promise<AppUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.status !== 'active') redirect('/pending')
  if (opts.admin && user.role !== 'super_admin') redirect('/')
  return user
}

type RouteContext<P> = { params: Promise<P> }

export interface RouteArgs<P> {
  req: NextRequest
  params: P
  user: AppUser
}

/**
 * Wraps every API route handler: authenticates, optionally requires super admin, resolves params,
 * and converts thrown ApiError/ZodError into `{ error, code }` responses.
 *
 *   export const GET = withRoute(async ({ params, user }) => { ... })
 */
export function withRoute<P = Record<string, never>>(
  handler: (args: RouteArgs<P>) => Promise<Response> | Response,
  opts: { admin?: boolean } = {},
) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    try {
      const user = opts.admin ? await requireSuperAdmin() : await requireUser()
      const params = (await ctx?.params) ?? ({} as P)
      return await handler({ req, params, user })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init)
}

export { ApiError }
