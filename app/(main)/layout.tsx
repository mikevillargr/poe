import type { Metadata } from 'next'
import './globals.css'
import { AppProviders } from '@/components/AppProviders'
import { Sidebar } from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Poe — Growth Rocket Content Intelligence',
  description: 'AI-powered content grading and scoring for brand compliance, SEO readiness, and topical safety.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
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
