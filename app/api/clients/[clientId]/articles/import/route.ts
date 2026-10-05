import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { Errors } from '@/lib/api/errors'
import { articleInputSchema } from '@/lib/articles/schemas'
import { importRows } from '@/lib/import/repo'
import { MAX_IMPORT_ROWS } from '@/lib/import/mapping'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  rows: z.array(z.object({ sheetRow: z.number().int().positive() }).passthrough()).min(1).max(MAX_IMPORT_ROWS),
  skipped: z.array(z.object({ row: z.number().int(), message: z.string().max(300) })).max(MAX_IMPORT_ROWS).default([]),
})

// POST { filename, rows: [{ sheetRow, title, brief, keywords, targetWordCount }], skipped } → { batchId, count }
// Every row is re-validated server-side; one invalid row rejects the request with its sheet row number.
export const POST = withRoute<{ clientId: string }>(async ({ req, params, user }) => {
  const client = await requireClient(params.clientId, { write: true })
  const { filename, rows, skipped } = bodySchema.parse(await req.json())

  const valid = rows.map((r) => {
    const parsed = articleInputSchema.safeParse(r)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      throw Errors.badRequest(`Row ${r.sheetRow}: ${issue?.message ?? 'invalid data'}`, { row: r.sheetRow })
    }
    return parsed.data
  })

  const result = await importRows(client.id, filename, valid, skipped, user)
  return json(result, { status: 201 })
})
