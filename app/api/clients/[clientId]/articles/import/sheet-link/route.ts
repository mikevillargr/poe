import { z } from 'zod'
import { withRoute, json } from '@/lib/auth/guards'
import { requireClient } from '@/lib/tenancy'
import { driveStatus } from '@/lib/google/drive'
import { readSheetAsUser } from '@/lib/google/user-sheets'
import { spreadsheetIdFrom } from '@/lib/google/ids'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({ url: z.string().min(10).max(2000) })

// POST { url } → { filename, sheetName, grid, truncated }, the same shape as …/import/parse, so the Import page's
// match & review steps are unchanged. DR-018: read with the signed-in person's own Google access (read-only).
// 409 SHEETS_NOT_CONNECTED when they haven't connected Google with Sheets access yet.
export const POST = withRoute<{ clientId: string }>(async ({ req, params, user }) => {
  await requireClient(params.clientId, { write: true })
  const { url } = bodySchema.parse(await req.json())
  if (!spreadsheetIdFrom(url)) return json({ error: 'That doesn’t look like a Google Sheets link.', code: 'SHEET_LINK_INVALID' }, { status: 400 })
  const status = await driveStatus(user.id)
  if (!status.connected || !status.canReadSheets) {
    return json({ error: 'Connect Google to let Poe read your sheets.', code: 'SHEETS_NOT_CONNECTED' }, { status: 409 })
  }
  return json(await readSheetAsUser(user.id, status.email, url))
})
