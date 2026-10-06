import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/guards'
import { ApiError } from '@/lib/api/errors'
import { completeDriveConnect } from '@/lib/google/drive'
import { DRIVE_CALLBACK_PATH, DRIVE_STATE_COOKIE } from '@/lib/google/drive-oauth'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// Google redirects here after consent (DR-014). The page tells the workspace window how it went, then closes.
// It answers with HTML, not JSON, because it runs inside the small Google window.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const cookieState = req.cookies.get(DRIVE_STATE_COOKIE)?.value ?? ''
  const state = params.get('state') ?? ''
  let result: { ok: boolean; email?: string; message?: string }
  let status = 200

  try {
    const user = await getCurrentUser()
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to Poe first.')
    if (user.status !== 'active') throw new ApiError(403, 'ACCOUNT_NOT_ACTIVE', 'Your Poe account isn’t active.')
    if (params.get('error')) throw new ApiError(400, 'DRIVE_CONNECT_CANCELLED', params.get('error') === 'access_denied' ? 'Google Drive access wasn’t allowed.' : `Google said: ${params.get('error')}`)
    const a = Buffer.from(state)
    const b = Buffer.from(cookieState)
    if (!state || a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(400, 'DRIVE_STATE_MISMATCH', 'This connection link expired. Try again.')
    const code = params.get('code')
    if (!code) throw new ApiError(400, 'DRIVE_CONNECT_FAILED', 'Google didn’t return a code.')
    result = { ok: true, email: await completeDriveConnect(user, code) }
  } catch (err) {
    result = { ok: false, message: err instanceof ApiError ? err.message : 'Couldn’t connect Google Drive. Try again.' }
    status = err instanceof ApiError ? err.status : 500
    if (!(err instanceof ApiError)) console.error('[drive] connect failed', err)
  }

  const payload = JSON.stringify({ source: 'poe-drive', ...result }).replace(/</g, '\\u003c')
  const text = result.ok ? 'Google Drive connected. You can close this window.' : `${result.message} You can close this window.`
  const html = `<!doctype html><meta charset="utf-8"><title>Google Drive</title>
<body style="font-family:system-ui,sans-serif;padding:24px;color:#333"><p>${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] as string)}</p>
<script>try{window.opener&&window.opener.postMessage(${payload},location.origin)}catch(e){}setTimeout(function(){window.close()},${result.ok ? 300 : 4000})</script></body>`
  const res = new NextResponse(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } })
  res.cookies.set(DRIVE_STATE_COOKIE, '', { path: DRIVE_CALLBACK_PATH, maxAge: 0 })
  return res
}
