# Lookahead

Commercial SaaS for UK construction SMEs. Turns master programmes (Primavera P6, MS Project) into 2/4-week lookahead task lists site teams can actually use.

See `CLAUDE.md` for the authoritative spec, `BRIEF.md` for product context, `AGENTS.md` for Next.js 16 caveats, `spacex-DESIGN.md` for visual direction.

## Status

**Phase 1** — scaffold + auth + orgs + projects + invites. Everything beyond that (programme upload, AI translation, dashboards, billing) is deferred.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind 4)
- Neon Postgres + Drizzle ORM
- Auth.js v5 with Drizzle adapter (argon2 password hashing + Google SSO) — **wired in PR 2**
- shadcn/ui primitives, re-themed per `spacex-DESIGN.md` (dark-only, Mission Blue accent)
- Resend for transactional email — **wired in PR 5**
- Vercel hosting

## Local setup

```bash
npm install
cp .env.local.example .env.local
# Fill in DATABASE_URL (Neon), AUTH_SECRET (openssl rand -base64 32), Google OAuth, Resend
npm run dev
```

Open http://localhost:3000.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm run db:generate` | Generate Drizzle SQL migration from schema |
| `npm run db:push` | Push schema to DB (dev only) |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Seed (no-op in Phase 1) |

## Deploy (Vercel)

```bash
npx vercel login
npx vercel --prod
```

Set env vars in the Vercel dashboard (same list as `.env.local.example`). Add the production URL `/api/auth/callback/google` to the Google Cloud Console OAuth client's authorised redirect URIs.

`vercel.json` ships security headers + `X-Robots-Tag: noindex, nofollow` while the product is in beta. Remove that header before public launch.

## Notes for contributors

- **Typography**: Geist (from `next/font/google`) is a placeholder. `spacex-DESIGN.md` specifies D-DIN. Swap once Datto's OFL D-DIN `.woff2` files are in `public/fonts/`.
- **Resend sender**: Phase 1 uses `onboarding@resend.dev` (Resend's built-in test sender). Swap to a verified domain (SPF + DKIM) before private beta.
- **Middleware**: Next.js 16 renamed middleware → **Proxy**. Use `src/proxy.ts`, not `src/middleware.ts`. Export `proxy` not `middleware`. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Tailwind 4**: no `tailwind.config.ts`. Theme tokens live in `src/app/globals.css` via `@theme inline { … }`.
