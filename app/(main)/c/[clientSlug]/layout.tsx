import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { RememberClient } from '@/components/shell/RememberClient'

// Resolves the client for every /c/[clientSlug]/* page. Pages call getClientBySlug again (cached
// per request by React) when they need the row.
export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ clientSlug: string }>
}) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client || client.archivedAt) notFound()
  return (
    <>
      <RememberClient slug={client.slug} />
      {children}
    </>
  )
}
