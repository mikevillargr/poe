import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import { ALLOWED_EMAIL_DOMAIN } from '@/lib/auth/policy'

// Edge-safe half of the auth config (used by middleware). No database access here; account status
// (pending/active/disabled) is checked per request by lib/auth/guards.ts.
export const authConfig = {
  providers: [
    // Reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from the environment.
    Google({
      authorization: { params: { hd: ALLOWED_EMAIL_DOMAIN, prompt: 'select_account' } },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login', error: '/login' },
} satisfies NextAuthConfig
