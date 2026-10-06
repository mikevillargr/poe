import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import '@/app/globals.css'
import { AppProviders } from '@/components/AppProviders'
import { Sidebar } from '@/components/shell/Sidebar'
import { requirePageUser } from '@/lib/auth/guards'
import { listClients } from '@/lib/tenancy'
import { pendingCount } from '@/lib/admin/users'
import { LAST_CLIENT_COOKIE } from '@/lib/nav'
import pkg from '@/package.json'

// FROZEN after foundation: change only via INITIATIVE §7.
export const metadata: Metadata = {
  title: 'Poe — Growth Rocket Content Hub',
  description: 'AI-powered content ideation, SEO-driven generation and human-in-the-loop editing.',
}

function rememberedClient(value: string | undefined): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser()
  const isSuperAdmin = user.role === 'super_admin'
  const [clients, pending] = await Promise.all([listClients(), isSuperAdmin ? pendingCount() : Promise.resolve(0)])
  const rememberedSlug = rememberedClient((await cookies()).get(LAST_CLIENT_COOKIE)?.value)

  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>
          <div className="flex h-screen bg-background text-body font-sans overflow-hidden">
            <Sidebar
              user={{ name: user.name, email: user.email, image: user.image, isSuperAdmin }}
              clients={clients}
              badges={{ users: pending }}
              version={pkg.version}
              rememberedSlug={rememberedSlug}
            />
            <div className="flex-1 ml-[240px] overflow-y-auto custom-scrollbar relative">{children}</div>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
