import * as XLSX from 'xlsx'
import { withRoute } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET → content-calendar-template.xlsx with the four expected columns and an example row.
export const GET = withRoute<{ clientId: string }>(async ({ params }) => {
  await requireClient(params.clientId)
  const ws = XLSX.utils.aoa_to_sheet([
    ['title', 'brief', 'keywords', 'wordcount'],
    [
      'How to Form an LLC in Nevada: A Step-by-Step Guide',
      'Walk first-time founders through forming a Nevada LLC, from name check to business license.',
      'form an llc in nevada, nevada llc, nevada registered agent',
      1800,
    ],
  ])
  ws['!cols'] = [{ wch: 50 }, { wch: 70 }, { wch: 50 }, { wch: 12 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Content calendar')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="content-calendar-template.xlsx"',
    },
  })
})
