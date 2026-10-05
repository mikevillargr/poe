import NextAuth from 'next-auth'
import { eq } from 'drizzle-orm'
import { authConfig } from './auth.config'
import { isAllowedGoogleIdentity, isSuperAdminEmail } from '@/lib/auth/policy'

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    // Only verified @growth-rocket.com Google accounts get a session. Everyone else starts pending
    // until a super admin approves them; SUPER_ADMIN_EMAIL is bootstrapped as an active super admin.
    async signIn({ account, profile }) {
      if (account?.provider !== 'google' || !isAllowedGoogleIdentity(profile)) {
        return false // → AccessDenied
      }
      const { db } = await import('@/lib/db')
      const { users } = await import('@/lib/db/schema')
      const email = profile!.email!.toLowerCase()
      const superAdmin = isSuperAdminEmail(email)

      await db
        .insert(users)
        .values({
          email,
          name: profile!.name ?? email,
          image: (profile!.picture as string | undefined) ?? null,
          googleSub: account.providerAccountId,
          role: superAdmin ? 'super_admin' : 'member',
          status: superAdmin ? 'active' : 'pending',
          lastLoginAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            name: profile!.name ?? email,
            image: (profile!.picture as string | undefined) ?? null,
            googleSub: account.providerAccountId,
            lastLoginAt: new Date(),
            ...(superAdmin ? { role: 'super_admin' as const, status: 'active' as const } : {}),
          },
        })
      return true
    },

    async jwt({ token, account, profile }) {
      if (account && profile?.email) {
        const { db } = await import('@/lib/db')
        const { users } = await import('@/lib/db/schema')
        const [row] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, profile.email.toLowerCase()))
          .limit(1)
        if (row) token.uid = row.id
      }
      return token
    },

    async session({ session, token }) {
      if (token.uid) session.user.id = token.uid
      return session
    },
  },
})
