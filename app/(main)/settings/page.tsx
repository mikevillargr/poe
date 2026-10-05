import { providerStatuses } from '@/lib/admin/ai-settings'
import { SettingsView } from '@/components/settings/SettingsView'

export const dynamic = 'force-dynamic'

// Settings (WS settings-admin, DR-007). Super-admin gate is in ./layout.tsx.
export default async function SettingsPage() {
  return <SettingsView initialProviders={await providerStatuses()} />
}
