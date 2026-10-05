import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'
import { authConfig } from './auth.config'
import { isPublicPath } from '@/lib/auth/policy'

// Edge-safe session check only. Account status (pending/disabled) and roles are enforced per
// request in lib/auth/guards.ts, which reads the DB.
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname, search } = req.nextUrl
  if (isPublicPath(pathname) || req.auth) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in required.', code: 'UNAUTHENTICATED' }, { status: 401 })
  }
  const login = new URL('/login', req.nextUrl.origin)
  login.searchParams.set('callbackUrl', pathname + search)
  return NextResponse.redirect(login)
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
