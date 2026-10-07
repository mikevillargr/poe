// DR-014: pure helpers for the per-user Google Drive connection (no DB, no network), so they can be unit-tested.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** DR-018: read-only Sheets, so a pasted sheet link can be imported with the person's own access. */
export const SHEETS_READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
/** openid + email let the callback check which Google account was connected. */
export const CONNECT_SCOPES = ['openid', 'email', DRIVE_SCOPE, SHEETS_READ_SCOPE].join(' ')

/** Whether a granted scope string (space-separated) includes read-only Sheets access. */
export function canReadSheets(scope: string | null | undefined): boolean {
  return !!scope && scope.split(/\s+/).some((s) => s === SHEETS_READ_SCOPE || s === 'https://www.googleapis.com/auth/spreadsheets')
}

/** The tab id from a Sheets link (`#gid=123` or `?gid=123`), if any. */
export function gidFrom(url: string): number | null {
  const m = /[#&?]gid=(\d+)/.exec(url)
  return m ? Number(m[1]) : null
}

export const DRIVE_STATE_COOKIE = 'poe_drive_state'
export const DRIVE_CALLBACK_PATH = '/api/google/drive/callback'

export function driveRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${DRIVE_CALLBACK_PATH}`
}

/** Google's consent URL: offline access (refresh token), always asking so a refresh token is issued. */
export function buildConnectUrl(opts: { clientId: string; redirectUri: string; state: string; loginHint: string; hostedDomain?: string }): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', opts.clientId)
  u.searchParams.set('redirect_uri', opts.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', CONNECT_SCOPES)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  u.searchParams.set('include_granted_scopes', 'true')
  u.searchParams.set('login_hint', opts.loginHint)
  if (opts.hostedDomain) u.searchParams.set('hd', opts.hostedDomain)
  u.searchParams.set('state', opts.state)
  return u.toString()
}

/**
 * Reads the email from an id_token Google returned to us directly over TLS (token endpoint), so the payload
 * is trusted without verifying the signature. Returns null when it's missing or unverified.
 */
export function idTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { email?: string; email_verified?: boolean }
    return payload.email && payload.email_verified !== false ? payload.email.toLowerCase() : null
  } catch {
    return null
  }
}

/** A Drive "multipart/related" upload body: metadata (the Google file type to convert to) + the content. */
export function multipartBody(name: string, targetMime: string, contentType: string, content: string, boundary: string): string {
  return (
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: targetMime }) +
    `\r\n--${boundary}\r\nContent-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
    content +
    `\r\n--${boundary}--`
  )
}

export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
export const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

/** HTML that Drive converts into a Google Doc. */
export function multipartDocBody(name: string, html: string, boundary: string): string {
  return multipartBody(name, GOOGLE_DOC_MIME, 'text/html', html, boundary)
}

export type DriveErrorCode = 'DRIVE_NOT_CONNECTED' | 'DRIVE_API_DISABLED' | 'DRIVE_FULL' | 'DRIVE_ERROR'

/** Maps a Drive API error response to a code and a message an editor can act on. */
export function classifyDriveError(status: number, body: unknown): { code: DriveErrorCode; message: string } {
  const err = (body as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } } | null)?.error
  const reasons = [...(err?.errors ?? []), ...(err?.details ?? [])].map((e) => e.reason)
  if (reasons.includes('accessNotConfigured') || reasons.includes('SERVICE_DISABLED')) {
    return { code: 'DRIVE_API_DISABLED', message: 'The Google Drive API isn’t enabled for Poe’s Google Cloud project. An admin needs to enable it.' }
  }
  if (status === 401) return { code: 'DRIVE_NOT_CONNECTED', message: 'Google Drive needs to be connected again.' }
  if (reasons.includes('storageQuotaExceeded')) return { code: 'DRIVE_FULL', message: 'Your Google Drive is full.' }
  return { code: 'DRIVE_ERROR', message: err?.message || `Google Drive returned ${status}.` }
}

/** DR-018: a Sheets API error, in words an editor can act on (they read the sheet with their own access). */
export function classifySheetsError(status: number, body: unknown, email: string | null): { status: number; code: string; message: string } {
  const err = (body as { error?: { message?: string; details?: { reason?: string }[] } } | null)?.error
  const reasons = (err?.details ?? []).map((d) => d.reason)
  const msg = err?.message ?? ''
  if (reasons.includes('SERVICE_DISABLED') || /has not been used|is disabled/i.test(msg)) {
    return { status: 502, code: 'SHEETS_API_DISABLED', message: 'The Google Sheets API isn’t enabled for Poe’s Google Cloud project. An admin needs to enable it.' }
  }
  if (reasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || /insufficient authentication scopes/i.test(msg)) {
    return { status: 409, code: 'SHEETS_NOT_CONNECTED', message: 'Connect Google again to let Poe read your sheets.' }
  }
  if (status === 401) return { status: 409, code: 'SHEETS_NOT_CONNECTED', message: 'Your Google connection expired. Connect Google again.' }
  if (status === 403) {
    return {
      status: 403,
      code: 'SHEET_NO_ACCESS',
      message: `You don’t have access to this sheet${email ? ` as ${email}` : ''}. Ask the owner to share it with you, then try again.`,
    }
  }
  if (status === 404) return { status: 404, code: 'SHEET_NOT_FOUND', message: 'That sheet wasn’t found. Check the link.' }
  return { status: 502, code: 'SHEETS_ERROR', message: msg ? `Google Sheets: ${msg}` : `Google Sheets returned ${status}.` }
}
