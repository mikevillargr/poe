import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { parseSheet } from '@/lib/import/parse'
import { MAX_IMPORT_BYTES } from '@/lib/import/mapping'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST multipart { file } → { filename, sheetName, grid, truncated }. Parsing only; nothing is saved.
export const POST = withRoute<{ clientId: string }>(async ({ req, params }) => {
  await requireClient(params.clientId, { write: true })
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw Errors.badRequest('Attach a .csv, .xlsx or .xls file.')
  if (file.size > MAX_IMPORT_BYTES) throw Errors.badRequest('The file is larger than 5 MB.')
  try {
    const parsed = parseSheet(Buffer.from(await file.arrayBuffer()), file.name)
    return json(parsed)
  } catch (err) {
    throw Errors.badRequest(err instanceof Error ? err.message : 'Could not read that file.')
  }
})
