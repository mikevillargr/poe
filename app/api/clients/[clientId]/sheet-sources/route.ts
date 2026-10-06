import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { serviceAccountStatus } from '@/lib/google/credentials'
import { createSheetSource, listSheetSources } from '@/lib/templates/inputs'
import { sheetSourceBody, toSourceInput } from '@/lib/templates/sheet-source-schema'

export const dynamic = 'force-dynamic'

// GET → { sources: [...], google: { configured, clientEmail } } (DR-011)
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  const client = await requireClient(params.clientId)
  const [sources, google] = await Promise.all([listSheetSources(client.id), serviceAccountStatus()])
  return json({ sources, google: { configured: google.configured, clientEmail: google.clientEmail } })
})

// POST { name, sheet, tab, headerRow?, target, templateId? | inventorySlug?, columnMap? } → 201 { id } ("Add sheet")
export const POST = withRoute<{ clientId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const body = sheetSourceBody.parse(await req.json())
  return json(await createSheetSource(client.id, toSourceInput(body), user), { status: 201 })
})
