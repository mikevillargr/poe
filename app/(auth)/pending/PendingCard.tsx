'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Clock, Ban } from 'lucide-react'
import { AuthCard } from '@/components/auth/AuthCard'

// DR-002 pending/disabled states, same card as login. Pending re-checks every 30s.
export function PendingCard({ email, disabled }: { email: string; disabled: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (disabled) return
    const t = setInterval(() => router.refresh(), 30_000)
    return () => clearInterval(t)
  }, [disabled, router])

  const Icon = disabled ? Ban : Clock
  return (
    <AuthCard
      title={disabled ? 'Access disabled' : 'Waiting for approval'}
      subtitle={
        <>
          Signed in as <span className="text-heading">{email}</span>
        </>
      }
      footer={
        <button type="button" onClick={() => signOut({ redirectTo: '/login' })} className="underline hover:text-heading">
          Sign out
        </button>
      }
    >
      <div className="flex items-start gap-3 p-4 rounded-input border border-border bg-surface">
        <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${disabled ? 'text-red-400' : 'text-accent'}`} />
        <p className="text-sm text-body">
          {disabled
            ? 'Your access to Poe has been disabled. Contact Mike if you think this is a mistake.'
            : 'An admin needs to approve your access. This page checks automatically and will let you in as soon as you’re approved.'}
        </p>
      </div>
    </AuthCard>
  )
}
