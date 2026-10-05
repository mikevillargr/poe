import type { Metadata } from 'next'
import '@/app/globals.css'
import { AppProviders } from '@/components/AppProviders'
import { Sidebar } from '@/components/shell/Sidebar'
import { requirePageUser } from '@/lib/auth/guards'
import { listClients } from '@/lib/tenancy'

// FROZEN after foundation: change only via INITIATIVE §7.
export const metadata: Metadata = {
  title: 'Poe — Growth Rocket Content Hub',
  description: 'AI-powered content ideation, SEO-driven generation and human-in-the-loop editing.',
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser()
  const clients = await listClients()

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>
          <div className="flex h-screen bg-background text-body font-sans overflow-hidden">
            <Sidebar
              user={{ name: user.name, email: user.email, image: user.image, isSuperAdmin: user.role === 'super_admin' }}
              clients={clients}
            />
            <div className="flex-1 ml-[240px] overflow-y-auto custom-scrollbar relative">{children}</div>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
