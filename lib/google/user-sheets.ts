import 'server-only'
import { ApiError } from '@/lib/api/errors'
import { MAX_IMPORT_ROWS } from '@/lib/import/mapping'
import { userAccessToken } from './drive'
import { classifySheetsError, gidFrom } from './drive-oauth'
import { spreadsheetIdFrom } from './ids'

// DR-018: read a pasted Google Sheet with the signed-in person's own Google access (read-only), into the same
// grid shape a file upload produces, so the import's match & review steps don't change.

const API = 'https://sheets.googleapis.com/v4/spreadsheets'

export interface LinkedSheet {
  /** "Spreadsheet title · Tab", shown in import history. */
  filename: string
  sheetName: string
  grid: string[][]
  truncated: boolean
}

function sheetsError(status: number, body: unknown, email: string | null): ApiError {
  const e = classifySheetsError(status, body, email)
  return new ApiError(e.status, e.code, e.message)
}

export async function readSheetAsUser(userId: string, email: string | null, link: string): Promise<LinkedSheet> {
  const id = spreadsheetIdFrom(link)
  if (!id) throw new ApiError(400, 'SHEET_LINK_INVALID', 'That doesn’t look like a Google Sheets link.')
  const token = await userAccessToken(userId)
  const headers = { authorization: `Bearer ${token}` }

  const metaRes = await fetch(`${API}/${id}?fields=properties.title,sheets.properties(sheetId,title,index)`, { headers })
  const meta = (await metaRes.json().catch(() => null)) as {
    properties?: { title?: string }
    sheets?: { properties: { sheetId: number; title: string; index: number } }[]
  } | null
  if (!metaRes.ok) throw sheetsError(metaRes.status, meta, email)
  const tabs = (meta?.sheets ?? []).map((s) => s.properties).sort((a, b) => a.index - b.index)
  const gid = gidFrom(link)
  const tab = (gid !== null ? tabs.find((t) => t.sheetId === gid) : undefined) ?? tabs[0]
  if (!tab) throw new ApiError(404, 'SHEET_NOT_FOUND', 'That spreadsheet has no tabs.')

  const range = encodeURIComponent(`'${tab.title.replace(/'/g, "''")}'`)
  const valRes = await fetch(`${API}/${id}/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`, { headers })
  const vals = (await valRes.json().catch(() => null)) as { values?: unknown[][] } | null
  if (!valRes.ok) throw sheetsError(valRes.status, vals, email)

  const limit = MAX_IMPORT_ROWS + 20
  const rows = (vals?.values ?? []).map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()) : []))
  while (rows.length && !rows[rows.length - 1].some(Boolean)) rows.pop()
  const title = meta?.properties?.title ?? 'Google Sheet'
  return { filename: `${title} · ${tab.title}`, sheetName: tab.title, grid: rows.slice(0, limit), truncated: rows.length > limit }
}
