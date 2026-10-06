import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { listTemplates } from '@/lib/templates/repo'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// GET → { templates: [{ id, slug, name, kind, enabled, revisionNo, inputs, researchEnabled }] } (D-002)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const rows = await listTemplates(client.id)
  return json({
    templates: rows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name: t.name,
      kind: t.kind,
      enabled: t.enabled,
      revisionNo: t.revisionNo,
      inputs: t.config.inputs,
      researchEnabled: t.config.researchEnabled,
    })),
  })
})
