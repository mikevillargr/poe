import { notFound } from 'next/navigation'
import { getClientBySlug } from '@/lib/tenancy'
import { listGuidelines } from '@/lib/guidelines/repo'
import { toGuidelineDTO } from '@/lib/guidelines/schemas'
import { GuidelinesView } from '@/components/guidelines/GuidelinesView'
import { requirePageUser } from '@/lib/auth/guards'

export const dynamic = 'force-dynamic'

// Per-client guidelines (WS guidelines, DR-006): manual-first categorized rules; document
// ingestion is a secondary action inside the view.
export default async function GuidelinesPage({ params }: { params: Promise<{ clientSlug: string }> }) {
  const { clientSlug } = await params
  const client = await getClientBySlug(clientSlug)
  if (!client) notFound()

  const [rows, user] = await Promise.all([listGuidelines(client.id), requirePageUser()])
  return (
    <GuidelinesView
      scope={{ kind: 'client', clientId: client.id, clientName: client.name, clientSlug, canEditUniversal: user.role === 'super_admin' }}
      initialGuidelines={rows.map(toGuidelineDTO)}
    />
  )
}
