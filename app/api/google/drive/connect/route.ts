import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { withRoute } from '@/lib/auth/guards'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/auth/policy'
import { oauthClient } from '@/lib/google/drive'
import { buildConnectUrl, DRIVE_CALLBACK_PATH, DRIVE_STATE_COOKIE } from '@/lib/google/drive-oauth'

export const dynamic = 'force-dynamic'

// GET → redirect to Google's consent screen (opened in a small window by the workspace, DR-014).
// A random state in an httpOnly cookie ties the callback to this browser.
export const GET = withRoute(async ({ user }) => {
  const { clientId, redirectUri } = oauthClient()
  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(buildConnectUrl({ clientId, redirectUri, state, loginHint: user.email, hostedDomain: ALLOWED_EMAIL_DOMAIN }))
  res.cookies.set(DRIVE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: redirectUri.startsWith('https://'),
    sameSite: 'lax',
    path: DRIVE_CALLBACK_PATH,
    maxAge: 600,
  })
  return res
})
