import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { deleteTemplate, saveTemplate, templateDetail } from '@/lib/templates/manage'

export const dynamic = 'force-dynamic'

type P = { clientId: string; templateId: string }

// GET → { template: { id, slug, name, kind, enabled, revisionNo, config }, revisions[], articles } (DR-010 editor)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  return json(await templateDetail(client.id, params.templateId))
})

const saveBody = z.object({
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  config: z.unknown(),
  note: z.string().trim().max(300).nullable().optional(),
})

// PUT { name, enabled, config, note? } → { revisionNo }. Validates the config; every save is a revision.
export const PUT = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const b = saveBody.parse(await req.json())
  return json(await saveTemplate(client.id, params.templateId, user, { ...b, config: b.config }))
})

// DELETE → { ok } (soft delete; 409 while articles use the template: disable it instead)
export const DELETE = withRoute<P>(async ({ params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  await deleteTemplate(client.id, params.templateId, user)
  return json({ ok: true })
})
