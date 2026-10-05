import { requirePageUser } from '@/lib/auth/guards'

// Super admin only. OWNED BY WS settings-admin (DR-007), which replaces the legacy page.tsx.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser({ admin: true })
  return <>{children}</>
}
