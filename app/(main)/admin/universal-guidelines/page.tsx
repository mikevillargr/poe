import { requirePageUser } from '@/lib/auth/guards'
import { listUniversalGuidelines } from '@/lib/guidelines/repo'
import { toUniversalGuidelineDTO } from '@/lib/guidelines/schemas'
import { GuidelinesView } from '@/components/guidelines/GuidelinesView'

export const dynamic = 'force-dynamic'

// Universal guidelines (WS guidelines, DR-006; live for every client since D-003): the agency-wide rules every client
// follows first. Super-admin gate mirrors ../users; also enforced by the API routes.
export default async function UniversalGuidelinesPage() {
  await requirePageUser({ admin: true })
  const rows = await listUniversalGuidelines()
  return <GuidelinesView scope={{ kind: 'universal' }} initialGuidelines={rows.map(toUniversalGuidelineDTO)} />
}
