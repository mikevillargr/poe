import { requirePageUser } from '@/lib/auth/guards'

// Super admin only.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser({ admin: true })
  return <>{children}</>
}
