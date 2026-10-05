import type { Metadata } from 'next'
import '@/app/globals.css'
import { AppProviders } from '@/components/AppProviders'
import { Sidebar } from '@/components/shell/Sidebar'
import { requirePageUser } from '@/lib/auth/guards'
import { listClients } from '@/lib/tenancy'
import { pendingCount } from '@/lib/admin/users'

// FROZEN after foundation: change only via INITIATIVE §7.
export const metadata: Metadata = {
  title: 'Poe — Growth Rocket Content Hub',
  description: 'AI-powered content ideation, SEO-driven generation and human-in-the-loop editing.',
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser()
  const isSuperAdmin = user.role === 'super_admin'
  const [clients, pending] = await Promise.all([listClients(), isSuperAdmin ? pendingCount() : Promise.resolve(0)])

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>
          <div className="flex h-screen bg-background text-body font-sans overflow-hidden">
            <Sidebar
              user={{ name: user.name, email: user.email, image: user.image, isSuperAdmin }}
              clients={clients}
              badges={{ users: pending }}
            />
            <div className="flex-1 ml-[240px] overflow-y-auto custom-scrollbar relative">{children}</div>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
