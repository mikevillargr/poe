import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userGoogleDrive } from '@/lib/db/schema'
import { decryptSecret, encryptSecret } from '@/lib/ai/secrets'
import { ApiError } from '@/lib/api/errors'
import { canReadSheets, classifyDriveError, driveRedirectUri, idTokenEmail, multipartDocBody } from './drive-oauth'

// DR-014: each person connects their own Google Drive once (drive.file scope). The refresh token is stored
// encrypted; exports upload on the server with a short-lived access token, so the browser's one-window-per-click
// allowance is free to open the new Doc.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink'

export function oauthClient() {
  const clientId = process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.AUTH_GOOGLE_SECRET
  const base = process.env.AUTH_URL
  if (!clientId || !clientSecret || !base) {
    throw new ApiError(503, 'DRIVE_NOT_CONFIGURED', 'Google Docs export isn’t set up on this server (Google client or AUTH_URL missing).')
  }
  return { clientId, clientSecret, redirectUri: driveRedirectUri(base) }
}

const notConnected = () => new ApiError(409, 'DRIVE_NOT_CONNECTED', 'Connect Google Drive to export.')

export async function driveStatus(userId: string): Promise<{ connected: boolean; email: string | null; canReadSheets: boolean }> {
  const [row] = await db
    .select({ email: userGoogleDrive.googleEmail, scope: userGoogleDrive.scope })
    .from(userGoogleDrive)
    .where(eq(userGoogleDrive.userId, userId))
    .limit(1)
  return { connected: !!row, email: row?.email ?? null, canReadSheets: canReadSheets(row?.scope) }
}

/** Exchanges the consent code, checks it's the signed-in person's own account, and stores the refresh token. */
export async function completeDriveConnect(user: { id: string; email: string }, code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = oauthClient()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string; scope?: string; error?: string; error_description?: string }
  if (!res.ok || !tok.access_token) throw new ApiError(502, 'DRIVE_CONNECT_FAILED', tok.error_description || tok.error || 'Google didn’t accept the connection.')

  const email = idTokenEmail(tok.id_token)
  if (!email || email !== user.email.toLowerCase()) {
    await revoke(tok.refresh_token ?? tok.access_token)
    throw new ApiError(403, 'DRIVE_WRONG_ACCOUNT', `Connect your own Google account (${user.email}).`)
  }
  if (!tok.refresh_token) {
    throw new ApiError(502, 'DRIVE_CONNECT_FAILED', 'Google didn’t return a lasting permission. Disconnect Poe in your Google account settings and try again.')
  }

  const enc = encryptSecret(tok.refresh_token)
  const values = { userId: user.id, googleEmail: email, keyCiphertext: enc.keyCiphertext, keyIv: enc.keyIv, keyTag: enc.keyTag, scope: tok.scope ?? null, updatedAt: new Date() }
  await db.insert(userGoogleDrive).values(values).onConflictDoUpdate({ target: userGoogleDrive.userId, set: values })
  tokens.set(user.id, { value: tok.access_token, expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000 })
  return email
}

export async function disconnectDrive(userId: string) {
  const [row] = await db.select().from(userGoogleDrive).where(eq(userGoogleDrive.userId, userId)).limit(1)
  tokens.delete(userId)
  if (!row) return
  await db.delete(userGoogleDrive).where(eq(userGoogleDrive.userId, userId))
  await revoke(decryptSecret(row))
}

async function revoke(token: string | undefined) {
  if (!token) return
  await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => {})
}

// Short-lived access tokens, per process (refreshed on demand; a restart just refreshes again).
const tokens = new Map<string, { value: string; expiresAt: number }>()

/** A short-lived access token for the person's own Google connection (DR-014/018). */
export async function userAccessToken(userId: string): Promise<string> {
  const cached = tokens.get(userId)
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.value
  const [row] = await db.select().from(userGoogleDrive).where(eq(userGoogleDrive.userId, userId)).limit(1)
  if (!row) throw notConnected()
  const { clientId, clientSecret } = oauthClient()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: decryptSecret(row), grant_type: 'refresh_token' }),
  })
  const tok = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
  if (!res.ok || !tok.access_token) {
    if (tok.error === 'invalid_grant') {
      // Revoked in the Google account, or expired: forget it so the next export asks to connect again.
      await db.delete(userGoogleDrive).where(eq(userGoogleDrive.userId, userId))
      throw notConnected()
    }
    throw new ApiError(502, 'DRIVE_ERROR', 'Couldn’t reach Google Drive. Try again.')
  }
  tokens.set(userId, { value: tok.access_token, expiresAt: Date.now() + (tok.expires_in ?? 3600) * 1000 })
  return tok.access_token
}

/** Uploads a full HTML document as a new Google Doc in the person's My Drive; returns its link. */
export async function createGoogleDoc(userId: string, name: string, html: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const boundary = `poe-${crypto.randomUUID()}`
    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${await userAccessToken(userId)}`, 'content-type': `multipart/related; boundary=${boundary}` },
      body: multipartDocBody(name, html, boundary),
    })
    const body = await res.json().catch(() => null)
    if (res.ok) {
      const { id, webViewLink } = body as { id: string; webViewLink?: string }
      return webViewLink || `https://docs.google.com/document/d/${id}/edit`
    }
    const { code, message } = classifyDriveError(res.status, body)
    // A 401 with a cached token: drop it and retry once with a fresh one.
    if (res.status === 401 && attempt === 0) {
      tokens.delete(userId)
      continue
    }
    throw new ApiError(code === 'DRIVE_NOT_CONNECTED' ? 409 : 502, code, message)
  }
  throw notConnected()
}
