import { withRoute, json } from '@/lib/auth/guards'
import { listUsers } from '@/lib/admin/users'

export const dynamic = 'force-dynamic'

// GET → { users: AdminUserDTO[] } (pending first). Super admin only.
export const GET = withRoute(async () => json({ users: await listUsers() }), { admin: true })
