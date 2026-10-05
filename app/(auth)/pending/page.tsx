import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/guards'
import { PendingCard } from './PendingCard'

export const dynamic = 'force-dynamic'

export default async function PendingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.status === 'active') redirect('/')
  return <PendingCard email={user.email} disabled={user.status === 'disabled'} />
}
