/**
 * Next.js 16 Proxy (formerly "middleware").
 * See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md.
 *
 * Runs on the Edge runtime — only imports the edge-safe `authConfig`.
 */
import NextAuth from 'next-auth';
import { authConfig } from '@/auth.config';

const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
