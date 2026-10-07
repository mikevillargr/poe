import { Link2Off } from 'lucide-react'
import type { Branding } from '@/lib/branding-defaults'
import { BrandMark } from './BrandMark'

export function LinkInactive({ branding }: { branding: Branding }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 bg-background">
      <BrandMark branding={branding} className="h-8" />
      <div className="glass-card max-w-[420px] w-full p-8 text-center">
        <Link2Off className="w-8 h-8 text-muted mx-auto mb-4" />
        <h1 className="text-2xl font-display text-heading mb-2">This link is no longer active</h1>
        <p className="text-sm text-muted">The article may have been unshared or the link reset. Ask your contact at {branding.agencyName} for a new one.</p>
      </div>
    </main>
  )
}
