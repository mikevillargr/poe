import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { TemplatesView } from '@/components/templates/TemplatesView'

export const dynamic = 'force-dynamic'

// A client's content templates and client facts (D-002, DR-010).
export default async function TemplatesPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()
  return <TemplatesView client={{ id: client.id, name: client.name, slug: client.slug }} />
}
