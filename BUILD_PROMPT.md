# Claude Code kickoff prompt — Lookahead, Phase 1

Paste the block below as the **first message** in a new Claude Code session opened in `C:\Users\kpang\.claude\codes\lookahead\`.

---

## Copy from here ↓

You are building **Lookahead** — a commercial SaaS for UK construction SMEs that turns master programmes (Primavera P6, MS Project) into 2/4-week lookahead task lists that site teams can actually use.

**Before writing any code:**

1. Read `CLAUDE.md` in this folder in full — it's the authoritative spec.
2. Read `AGENTS.md` — Next.js 16 has breaking changes from your training data. Read `node_modules/next/dist/docs/` before touching the App Router.
3. Read `BRIEF.md` for product context and positioning.
4. Glance at `C:\Users\kpang\.claude\codes\CMM Got Talent Voting` — this is the scaffold pattern to clone from (Next.js 16 + Neon + Drizzle + admin dashboard + API routes). **Do not copy its bcryptjs auth** — Lookahead uses Auth.js v5.
5. Glance at `C:\Users\kpang\.claude\codes\cheesmans-classic\vercel.json` — lift the security headers pattern wholesale; add `X-Robots-Tag: noindex` while in beta.
6. Read `C:\Users\kpang\.claude\codes\_deploy-prompt-template.md` and the memory files it references — you'll need them when I ask you to deploy.

**Your task for this session — Phase 1 only:**

Scaffold the repo and ship a working deploy where I can:

- Sign up (email/password + Google SSO)
- Create an organisation called "Pang & Chiu"
- Create a project inside it called "NOS09"
- Invite a second email address to join the org
- See both org and project on the dashboard

**Do not build** programme upload, task translation, dashboards, or any Phase 2+ work yet. CLAUDE.md §6 has the full Phase 1 scope and exit criteria.

**Stack (locked, from CLAUDE.md §2):**
- Next.js 16 App Router + TypeScript + Tailwind 4
- Neon Postgres + Drizzle ORM
- Auth.js v5 with Drizzle adapter (Google provider + credentials with argon2 hashing)
- shadcn/ui
- Resend for email
- Vercel for deploy

**Style (same rules as my other projects):**
- British spelling
- Executive-brief format if writing summaries: context → issue → analysis → recommendation → next steps
- Tables for comparisons
- Don't re-summarise what I can read in the diff
- When I defer a decision to you, pick the best option with reasoning; don't re-ask

**Before you start coding, show me:**

1. Your Phase 1 plan as a numbered step list (use plan mode if available)
2. Any questions you have about copy, branding, or scope — ask them upfront, not mid-build
3. Confirmation that you've read CLAUDE.md, AGENTS.md, and the Next.js 16 docs

**One hard rule:** open a PR (or logical commit set) for each feature boundary. Don't land everything in one commit.

Ready — show me the plan.

## ↑ Copy to here

---

## How to use

1. Open a new Claude Code session in `C:\Users\kpang\.claude\codes\lookahead`
2. Paste the block above as your first message
3. Review Claude's plan
4. Answer any upfront questions
5. Approve, and let it build

## What I'll need from Billy before the agent can finish Phase 1

- [ ] Neon project + connection string (set up a free Neon account, create a new project called `lookahead-dev`)
- [ ] Resend API key (sign up at resend.com, free tier is fine)
- [ ] Google Cloud Console OAuth client (for Google SSO — Billy's existing Google Workspace account can issue this)
- [ ] Domain decision — use placeholder `lookahead.local` for dev, buy real domain when ready to ship
- [ ] Vercel account (Billy already has one from pangandchiu deploys)
