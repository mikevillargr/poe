// DR-014: pure helpers for the per-user Google Drive connection (no DB, no network), so they can be unit-tested.

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
/** openid + email let the callback check which Google account was connected. */
export const CONNECT_SCOPES = ['openid', 'email', DRIVE_SCOPE].join(' ')
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

/** A Drive "multipart/related" upload body: metadata (as a Google Doc) + the HTML Drive converts. */
export function multipartDocBody(name: string, html: string, boundary: string): string {
  return (
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: 'application/vnd.google-apps.document' }) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    html +
    `\r\n--${boundary}--`
  )
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
