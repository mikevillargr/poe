import type { Metadata } from 'next'
import '@/app/globals.css'
import { ToastContainer } from '@/hooks/useToast'

// DR-021: shared article pages for people outside Poe. Always light, never indexed.
export const metadata: Metadata = {
  title: 'Article preview',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ToastContainer />
      </body>
    </html>
  )
}
