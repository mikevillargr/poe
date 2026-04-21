import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login — Poe',
  description: 'Sign in to Poe',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
