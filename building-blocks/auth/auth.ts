// auth.ts — NextAuth v5 (next-auth@beta) configuration with a Credentials provider.
// Dest: src/auth.ts (referenced by route handler, middleware and server components).

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { verifyPassword } from "./password";

/**
 * Shape of the user returned by `authorize()` and stored in the JWT.
 */
interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

// Augment the session so `session.user.id` is typed.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<AuthUser | null> {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // TODO: replace with your database lookup (see database block)
        // Example with the database block's prisma client:
        //   const dbUser = await prisma.user.findUnique({ where: { email } });
        //   if (!dbUser) return null;
        //   const valid = await verifyPassword(password, dbUser.passwordHash);
        //   if (!valid) return null;
        //   return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
        const dbUser: { id: string; email: string; name: string | null; passwordHash: string } | null =
          null;

        if (!dbUser) return null;

        const valid = await verifyPassword(password, dbUser.passwordHash);
        if (!valid) return null;

        return { id: dbUser.id, email: dbUser.email, name: dbUser.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as AuthUser).id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
