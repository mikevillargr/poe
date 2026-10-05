import type { Metadata } from 'next'
import '@/app/globals.css'
import { AppProviders } from '@/components/AppProviders'
import { Sidebar } from '@/components/Sidebar'
import { requirePageUser } from '@/lib/auth/guards'

export const metadata: Metadata = {
  title: 'Poe — Growth Rocket Content Intelligence',
  description: 'AI-powered content grading and scoring for brand compliance, SEO readiness, and topical safety.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requirePageUser()
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>
          <div className="flex h-screen bg-background text-body font-sans overflow-hidden">
            <Sidebar />
            <div className="flex-1 ml-[240px] overflow-y-auto custom-scrollbar relative">
              {children}
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  )
}
