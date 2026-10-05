import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Building2 } from 'lucide-react'
import { listClients } from '@/lib/tenancy'
import { LAST_CLIENT_COOKIE } from '@/lib/nav'

export const dynamic = 'force-dynamic'

// `/` → the last client you used (cookie is a convenience only), else the first client.
export default async function RootPage() {
  const clients = await listClients()
  const last = (await cookies()).get(LAST_CLIENT_COOKIE)?.value
  const target = clients.find((c) => c.slug === last) ?? clients[0]
  if (target) redirect(`/c/${target.slug}`)

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="glass-card p-8 max-w-md text-center space-y-3">
        <Building2 className="w-8 h-8 text-accent mx-auto" />
        <h1 className="text-xl font-display text-heading">No clients yet</h1>
        <p className="text-muted text-sm">Use the client menu in the sidebar to add your first client.</p>
      </div>
    </div>
  )
}
