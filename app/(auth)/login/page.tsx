import { redirect } from 'next/navigation'

// TODO(DR-002): replace with the approved "Continue with Google" card. Until the design is approved
// this forwards to NextAuth's built-in sign-in page (Google is the only provider).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  const target = new URLSearchParams({ callbackUrl: callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : '/' })
  redirect(`/api/auth/signin?${target}`)
}
