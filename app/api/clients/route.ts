import { withRoute, json } from '@/lib/auth/guards'
import { createClient, listClients } from '@/lib/tenancy'
import { createClientSchema } from '@/lib/clients/schemas'

export const dynamic = 'force-dynamic'

// GET /api/clients → { clients: ClientSummary[] }
export const GET = withRoute(async () => json({ clients: await listClients() }))

// POST /api/clients { name, slug, website?, notes? } → { client, universalRules }
export const POST = withRoute(async ({ req, user }) => {
  const input = createClientSchema.parse(await req.json())
  const { client, universalRules } = await createClient(input, user)
  return json(
    {
      client: { id: client.id, name: client.name, slug: client.slug, website: client.website },
      universalRules,
    },
    { status: 201 },
  )
})
