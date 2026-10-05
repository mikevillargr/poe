import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/guards'
import { signOut } from '@/auth'

// TODO(DR-002): functional placeholder; replace with the approved pending/disabled card design.
export default async function PendingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'active') redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="glass-card max-w-[400px] w-full p-8 text-center space-y-3">
        <h1 className="text-heading text-lg font-semibold">
          {user.status === 'disabled' ? 'Access disabled' : 'Waiting for approval'}
        </h1>
        <p className="text-muted text-sm">
          Signed in as {user.email}.{' '}
          {user.status === 'disabled'
            ? 'Your access has been disabled. Contact Mike.'
            : 'An admin needs to approve your access. Refresh this page once you have been approved.'}
        </p>
        <form
          action={async () => {
            'use server'
            await signOut({ redirectTo: '/login' })
          }}
        >
          <button type="submit" className="text-sm text-muted underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}
