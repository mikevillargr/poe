import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    CredentialsProvider({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Dynamic import to avoid build-time database access
        const { db } = await import('@/lib/db')
        const { users } = await import('@/lib/db/schema')
        const { eq } = await import('drizzle-orm')
        const bcrypt = await import('bcryptjs')

        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const userRecords = await db
          .select()
          .from(users)
          .where(eq(users.username, credentials.username as string))
          .limit(1)

        const user = userRecords[0]

        if (!user) {
          return null
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.username = user.username
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
})
