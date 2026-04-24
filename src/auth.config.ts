/**
 * Edge-safe subset of Auth.js config.
 *
 * Consumed by `src/proxy.ts` (Next.js 16 Edge runtime). Do NOT import
 * `@/auth`, `@/db`, `@/actions/*`, `@node-rs/argon2`, or anything with
 * Node-only dependencies from this file — it would break the Edge build.
 *
 * The full config lives in `src/auth.ts` and adds the Credentials provider
 * and the Drizzle adapter. Both configs share `authConfig`.
 */
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  providers: [Google],
  callbacks: {
    authorized: ({ auth, request }) => {
      const { pathname } = request.nextUrl;
      const isAuthed = !!auth?.user;
      const isAppRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/orgs');
      if (isAppRoute && !isAuthed) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
