import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { requirePageUser } from '@/lib/auth/guards'
import { SourcesView } from '@/components/sources/SourcesView'

export const dynamic = 'force-dynamic'

// Link lists and Google Sheets for a client (D-002, DR-011).
export default async function SourcesPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const [user, client] = await Promise.all([requirePageUser(), getClientBySlug(clientSlug)])
  if (!client) notFound()
  return <SourcesView client={{ id: client.id, name: client.name, slug: client.slug }} isSuperAdmin={user.role === 'super_admin'} />
}
