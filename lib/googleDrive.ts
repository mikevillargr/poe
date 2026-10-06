// Google Docs export from the browser: Google Identity Services gets a short-lived token for the
// `drive.file` scope (only files Poe creates), then the article is uploaded as HTML and Drive converts it
// into a Google Doc. No API key and nothing baked in at build time: the OAuth client ID (the same public ID
// Poe signs in with) is passed in from the server.

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface TokenClient {
  callback: (resp: TokenResponse) => void
  error_callback?: (err: { type?: string; message?: string }) => void
  requestAccessToken: (opts?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: TokenResponse) => void
            error_callback?: (err: { type?: string; message?: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let gisPromise: Promise<void> | null = null
let token: { value: string; expiresAt: number } | null = null

/** Loads Google Identity Services once. Call it early (e.g. on page load) so the sign-in popup can open
 *  straight from the click; browsers block popups opened after a long wait. */
export function preloadGoogleDrive(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (!gisPromise) {
    gisPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = GIS_SRC
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        gisPromise = null
        reject(new Error('Couldn’t load Google sign-in. Check your connection or ad blocker and try again.'))
      }
      document.head.appendChild(s)
    })
  }
  return gisPromise
}

function getToken(clientId: string): Promise<string> {
  if (token && Date.now() < token.expiresAt - 60_000) return Promise.resolve(token.value)
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2) return Promise.reject(new Error('Google sign-in isn’t loaded yet. Try again in a moment.'))
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (!resp.access_token) {
          reject(new Error(resp.error === 'access_denied' ? 'Google Drive access wasn’t allowed.' : resp.error_description || resp.error || 'Google sign-in failed.'))
          return
        }
        token = { value: resp.access_token, expiresAt: Date.now() + (resp.expires_in ?? 3600) * 1000 }
        resolve(resp.access_token)
      },
      error_callback: (err) =>
        reject(
          new Error(
            err.type === 'popup_closed'
              ? 'The Google window was closed before finishing.'
              : err.type === 'popup_failed_to_open'
                ? 'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
                : err.message || 'Google sign-in failed.',
          ),
        ),
    })
    client.requestAccessToken({ prompt: token ? '' : 'consent' })
  })
}

/** Turns a Drive API error body into something an editor can act on. */
function driveError(status: number, body: unknown): Error {
  const err = (body as { error?: { message?: string; errors?: { reason?: string }[]; details?: { reason?: string }[] } })?.error
  const reasons = [...(err?.errors ?? []), ...(err?.details ?? [])].map((e) => e.reason)
  if (reasons.includes('accessNotConfigured') || reasons.includes('SERVICE_DISABLED')) {
    return new Error('The Google Drive API isn’t enabled for Poe’s Google Cloud project. An admin needs to enable it.')
  }
  if (status === 401) {
    token = null
    return new Error('Your Google session expired. Try again.')
  }
  if (status === 403 && reasons.includes('storageQuotaExceeded')) return new Error('Your Google Drive is full.')
  return new Error(err?.message || `Google Drive returned ${status}.`)
}

/** Uploads `html` as a new Google Doc in the user's Drive and returns its link. */
export async function uploadHtmlAsGoogleDoc(clientId: string, name: string, html: string): Promise<string> {
  if (!clientId) throw new Error('Google Docs export isn’t set up on this server (no Google client ID).')
  await preloadGoogleDrive()
  const accessToken = await getToken(clientId)

  const boundary = `poe-${Math.random().toString(36).slice(2)}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name, mimeType: 'application/vnd.google-apps.document' }) +
    `\r\n--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n` +
    html +
    `\r\n--${boundary}--`

  const res = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw driveError(res.status, json)
  const { id, webViewLink } = json as { id: string; webViewLink?: string }
  return webViewLink || `https://docs.google.com/document/d/${id}/edit`
}
