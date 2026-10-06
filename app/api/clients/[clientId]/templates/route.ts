import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { listTemplates } from '@/lib/templates/repo'
import { createTemplate, templateSummaries } from '@/lib/templates/manage'

export const dynamic = 'force-dynamic'

type P = { clientId: string }

// GET → { templates: [{ id, slug, name, kind, enabled, revisionNo, inputs, researchEnabled, updatedAt, updatedBy, articles }] } (D-002)
export const GET = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const [rows, summaries] = await Promise.all([listTemplates(client.id), templateSummaries(client.id)])
  const extra = new Map(summaries.map((s) => [s.id, s]))
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
      hooks: t.config.hooks.map((h) => h.id),
      updatedAt: extra.get(t.id)?.updatedAt ?? null,
      updatedBy: extra.get(t.id)?.updatedBy ?? null,
      articles: extra.get(t.id)?.articles ?? 0,
    })),
  })
})

const createBody = z.object({
  name: z.string().trim().min(1).max(80),
  from: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('standard') }),
    z.object({ kind: z.literal('template'), templateId: z.string().uuid(), clientId: z.string().uuid().optional() }),
  ]),
})

// POST { name, from: { kind: 'standard' } | { kind: 'template', templateId, clientId? } } → 201 { id, slug } (DR-010 "New template")
export const POST = withRoute<P>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = createBody.parse(await req.json())
  if (body.from.kind === 'template' && body.from.clientId) await requireClient(body.from.clientId)
  return json(await createTemplate(client.id, user, body.name, body.from), { status: 201 })
})
