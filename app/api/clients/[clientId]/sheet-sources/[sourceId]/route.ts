import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { deleteSheetSource, updateSheetSource } from '@/lib/templates/inputs'
import { sheetSourceBody, toSourceInput } from '@/lib/templates/sheet-source-schema'

export const dynamic = 'force-dynamic'

type P = { clientId: string; sourceId: string }
const checkId = (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Errors.notFound('Sheet source')
}

// PUT (same body as POST) → { id }
export const PUT = withRoute<P>(async ({ req, params }) => {
  const client = await requireClient(params.clientId, { write: true })
  checkId(params.sourceId)
  return json(await updateSheetSource(client.id, params.sourceId, toSourceInput(sheetSourceBody.parse(await req.json()))))
})

// DELETE → { ok } (articles and links already imported stay)
export const DELETE = withRoute<P>(async ({ params }) => {
  const client = await requireClient(params.clientId, { write: true })
  checkId(params.sourceId)
  await deleteSheetSource(client.id, params.sourceId)
  return json({ ok: true })
})
