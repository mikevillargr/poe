import 'server-only'
import { createSign } from 'node:crypto'

// Read-only Google Sheets access as a service account (D-002). The token is a self-signed RS256 JWT
// exchanged at Google's token endpoint (no googleapis dependency). Each sheet must be shared with the
// service account's email as a Viewer.

export interface ServiceAccount {
  clientEmail: string
  privateKey: string
}

export class SheetsError extends Error {
  constructor(
    public code: 'SHEETS_NOT_CONFIGURED' | 'SHEETS_AUTH' | 'SHEETS_FORBIDDEN' | 'SHEETS_NOT_FOUND' | 'SHEETS_ERROR',
    message: string,
  ) {
    super(message)
  }
}

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** Validates a downloaded service-account key file (JSON). */
export function parseServiceAccountJson(raw: string): ServiceAccount {
  let data: unknown
  try {
    data = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf8'))
  } catch {
    throw new SheetsError('SHEETS_AUTH', 'That isn’t a service-account key file (JSON).')
  }
  const d = data as Record<string, unknown>
  if (d.type !== 'service_account' || typeof d.client_email !== 'string' || typeof d.private_key !== 'string') {
    throw new SheetsError('SHEETS_AUTH', 'The key file must be a Google service-account JSON key (type "service_account" with client_email and private_key).')
  }
  if (!d.private_key.includes('PRIVATE KEY')) throw new SheetsError('SHEETS_AUTH', 'The key file has no private key.')
  return { clientEmail: d.client_email, privateKey: d.private_key }
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url')

/** The signed JWT assertion for the token request. */
export function buildAssertion(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify({ iss: sa.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 }))
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).sign(sa.privateKey)
  return `${header}.${claims}.${b64url(signature)}`
}

const tokenCache = new Map<string, { token: string; expires: number }>()

export async function accessToken(sa: ServiceAccount): Promise<string> {
  const cached = tokenCache.get(sa.clientEmail)
  if (cached && cached.expires > Date.now() + 60_000) return cached.token
  let assertion: string
  try {
    assertion = buildAssertion(sa)
  } catch {
    throw new SheetsError('SHEETS_AUTH', 'The service-account private key can’t be used to sign.')
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(20_000),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !body.access_token) {
    throw new SheetsError('SHEETS_AUTH', `Google rejected the service account: ${body.error_description ?? `HTTP ${res.status}`}.`)
  }
  tokenCache.set(sa.clientEmail, { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000 })
  return body.access_token
}

/** A1 range for a tab, quoting the tab name: `'COMMUNITY PAGE LINKS/TRIBES'!A1:Z1000`. */
export function a1Range(tab: string, range?: string | null): string {
  return `'${tab.replace(/'/g, "''")}'${range ? `!${range}` : ''}`
}

/** Cell values (formatted, as shown in Sheets) of one tab, as a grid of trimmed strings. */
export async function readSheet(sa: ServiceAccount, spreadsheetId: string, tab: string, range?: string | null): Promise<string[][]> {
  const token = await accessToken(sa)
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(a1Range(tab, range))}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) })
  if (res.status === 403) {
    throw new SheetsError('SHEETS_FORBIDDEN', `Poe can’t open this spreadsheet. Share it with ${sa.clientEmail} as a Viewer.`)
  }
  if (res.status === 404) throw new SheetsError('SHEETS_NOT_FOUND', 'Spreadsheet not found. Check its ID.')
  if (res.status === 400) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new SheetsError('SHEETS_NOT_FOUND', `Google couldn’t read “${tab}”: ${body.error?.message ?? 'bad range'}.`)
  }
  if (!res.ok) throw new SheetsError('SHEETS_ERROR', `Google Sheets returned ${res.status}.`)
  const body = (await res.json()) as { values?: unknown[][] }
  return (body.values ?? []).map((row) => row.map((c) => String(c ?? '').trim()))
}
