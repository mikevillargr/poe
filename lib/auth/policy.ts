// Who may sign in. Edge-safe (no DB access), shared by auth.config.ts and auth.ts.

export const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || 'growth-rocket.com').toLowerCase()
export const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'mike@growth-rocket.com').toLowerCase()

type GoogleIdentity = { email?: string | null } & Record<string, unknown>

// The `hd` authorization param only filters Google's account chooser; this is the real check.
export function isAllowedGoogleIdentity(profile: GoogleIdentity | undefined): boolean {
  if (!profile?.email || profile.email_verified !== true) return false
  const email = profile.email.toLowerCase()
  const hd = typeof profile.hd === 'string' ? profile.hd.toLowerCase() : ''
  return email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`) && hd === ALLOWED_EMAIL_DOMAIN
}

export function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase() === SUPER_ADMIN_EMAIL
}

// Reachable without a session.
export const PUBLIC_PATHS = ['/login', '/pending', '/api/auth', '/api/health']

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
