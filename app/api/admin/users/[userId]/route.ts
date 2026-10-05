import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { changeUser } from '@/lib/admin/users'

export const dynamic = 'force-dynamic'

const changeSchema = z
  .object({ status: z.enum(['active', 'disabled']).optional(), role: z.enum(['super_admin', 'member']).optional() })
  .refine((c) => c.status || c.role, 'Nothing to change.')

// PATCH { status?: 'active'|'disabled', role?: 'super_admin'|'member' } → { user }
// Approve = status active; Deny/Disable = status disabled. Guards in lib/admin/users.ts.
export const PATCH = withRoute<{ userId: string }>(
  async ({ req, params, user }) => json({ user: await changeUser(user, params.userId, changeSchema.parse(await req.json())) }),
  { admin: true },
)
