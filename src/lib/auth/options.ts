import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { validateAdminCredentials } from './credentials'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'ForgePilot Login',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return validateAdminCredentials(credentials?.email, credentials?.password)
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = 'tenantId' in user ? user.tenantId : 'default'
        token.role = 'role' in user ? user.role : 'owner'
      }
      return token
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        tenantId: typeof token.tenantId === 'string' ? token.tenantId : 'default',
        role: token.role === 'owner' ? 'owner' : 'owner',
      }
      return session
    },
  },
}
