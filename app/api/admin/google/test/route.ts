import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { getServiceAccount } from '@/lib/google/credentials'
import { accessToken, readSheet, SheetsError } from '@/lib/google/sheets'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ spreadsheetId: z.string().max(200).optional(), tab: z.string().max(200).optional() })

// POST { spreadsheetId?, tab? } → { ok, message, rows? } — checks the key (and, if given, that a sheet is readable).
export const POST = withRoute(async ({ req }) => {
  const body = bodySchema.parse(await req.json().catch(() => ({})))
  try {
    const sa = await getServiceAccount()
    await accessToken(sa)
    if (!body.spreadsheetId) return json({ ok: true, message: `Connected as ${sa.clientEmail}.` })
    const grid = await readSheet(sa, body.spreadsheetId, body.tab ?? 'Sheet1', 'A1:Z5')
    return json({ ok: true, message: `Read ${grid.length} rows from “${body.tab ?? 'Sheet1'}”.`, rows: grid })
  } catch (err) {
    if (err instanceof SheetsError) return json({ ok: false, code: err.code, message: err.message })
    throw err
  }
}, { admin: true })
