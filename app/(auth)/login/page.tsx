import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/guards'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>
}) {
  const { callbackUrl, error } = await searchParams
  const user = await getCurrentUser()
  if (user) redirect(user.status === 'active' ? '/' : '/pending')

  const safeCallback = callbackUrl && callbackUrl.startsWith('/') && !callbackUrl.startsWith('//') ? callbackUrl : '/'
  return <LoginForm callbackUrl={safeCallback} error={error} />
}
