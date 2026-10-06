import * as XLSX from 'xlsx'
import { withRoute } from '@/lib/auth/guards'
import { Errors } from '@/lib/api/errors'
import { requireClient } from '@/lib/tenancy'
import { listTemplates } from '@/lib/templates/repo'
import { formatById, sampleFilename, sampleRows } from '@/lib/import/sheet-format'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET ?format=calendar|links|tpl-<templateId> → a sample .xlsx built from the same format the Sheet format
// panel shows (DR-015): the header row (if the shape has one) and two example rows.
export const GET = withRoute<{ clientId: string }>(async ({ req, params }) => {
  const client = await requireClient(params.clientId)
  const id = req.nextUrl.searchParams.get('format') ?? 'calendar'
  const templates = id.startsWith('tpl-')
    ? (await listTemplates(client.id)).map((t) => ({ id: t.id, name: t.name, kind: t.kind, inputs: t.config.inputs }))
    : []
  const format = formatById(id, templates)
  if (!format) throw Errors.notFound('Sheet format')

  const rows = sampleRows(format)
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = format.columns.map((_, i) => ({ wch: Math.min(60, Math.max(14, ...rows.map((r) => (r[i] ?? '').length + 2))) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, format.title.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${sampleFilename(format, 'xlsx')}"`,
    },
  })
})
