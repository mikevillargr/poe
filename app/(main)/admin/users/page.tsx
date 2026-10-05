import { requirePageUser } from '@/lib/auth/guards'
import { listUsers } from '@/lib/admin/users'
import { UsersView } from '@/components/admin/UsersView'

export const dynamic = 'force-dynamic'

// Users (WS settings-admin, DR-008). Super-admin gate is in ../layout.tsx.
export default async function UsersPage() {
  const me = await requirePageUser({ admin: true })
  return <UsersView initialUsers={await listUsers()} currentUserId={me.id} />
}
