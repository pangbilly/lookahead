# Lookahead — Claude Code Spec

*For Claude Code agents building this repo. Billy Kin Pang · owner. Start date: 24 April 2026.*

> **Read this before writing any code.** This is the authoritative spec for the Lookahead MVP. Every decision below has been taken deliberately. If something seems wrong, flag it before changing it. Also read `AGENTS.md` (Next.js 16 warning) and `BRIEF.md` (product context) in the same folder.

---

## 1. Project overview

**Lookahead** is a commercial SaaS for UK construction SMEs that:

1. Ingests a construction programme (PDF from MS Project or Primavera P6 in v1; Excel, native MSP/P6 later)
2. Uses Claude to extract activities and translate them into a clean 2- or 4-week lookahead of plain-English tasks
3. Lets a programme manager assign tasks to named team members
4. Exposes a dashboard showing status across the team — who's doing what, what's slipping, what's blocked

**Positioning.** "Upload your programme. Get a lookahead your site team can actually use. Track who's doing what — without touching Primavera again."

**Target customer.** Tier-2 / tier-3 UK construction contractors (£5m-£100m turnover) who are expected to deliver against a client's Primavera programme but don't have a planner full-time. Also tier-1 delivery teams (like Barhale on the NOS programme) wanting to cascade the programme to site without rekeying.

**Two user personas.**
- **Programme manager / owner** — uploads programme, reviews extraction, assigns tasks, monitors dashboard.
- **Team member** — sees their personal to-do list, marks tasks done, raises blockers.

Full product context is in `BRIEF.md` (same folder).

---

## 2. Tech stack — these are locked, do not change without asking Billy

| Layer | Choice |
|---|---|
| Framework | **Next.js 16** (App Router, TypeScript, Tailwind 4) |
| Database | **Neon Postgres** via `@neondatabase/serverless` |
| ORM | **Drizzle** + `drizzle-kit` |
| Auth | **Auth.js v5 (NextAuth)** with Drizzle adapter |
| UI components | **shadcn/ui** on Tailwind 4 |
| AI | **Claude Sonnet 4.6** via `@anthropic-ai/sdk` |
| PDF parse | **pdf.js** text-layer extraction as primary path; **Claude vision** as fallback |
| Email | **Resend** via `resend` npm package |
| Hosting | **Vercel** |
| Payments | **Stripe** (Phase 2 — not MVP) |

**Reference scaffold.** Start by copying structure from `C:\Users\kpang\.claude\codes\CMM Got Talent Voting` (it's the most mature Next.js/Neon/Drizzle app in the codebase). Then swap bcryptjs auth for Auth.js v5.

---

## 3. ⚠️ Next.js 16 caveat

This is **not the Next.js you know from training data.** APIs, conventions, and file structure differ. Read the relevant doc in `node_modules/next/dist/docs/` before writing any App Router, server action, or API-route code. Heed deprecation notices. See `AGENTS.md`.

---

## 4. Data model — Drizzle schema

Put in `src/db/schema.ts`.

```ts
import { pgTable, text, timestamp, uuid, integer, boolean, jsonb, date, primaryKey } from 'drizzle-orm/pg-core';

// Auth.js tables (Users, Accounts, Sessions, VerificationTokens) — use the standard adapter schema.

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const organizationMembers = pgTable('organization_members', {
  userId: text('user_id').notNull(), // Auth.js user id is text
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'pm', 'member'] }).notNull().default('member'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.organizationId] }) }));

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  client: text('client'),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const programmes = pgTable('programmes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  sourceFormat: text('source_format', { enum: ['pdf', 'xlsx', 'mpp', 'xer', 'xml'] }).notNull(),
  sourceFileUrl: text('source_file_url').notNull(), // Vercel Blob URL
  sourceToolDetected: text('source_tool_detected', { enum: ['ms_project', 'primavera_p6', 'other'] }),
  status: text('status', { enum: ['uploaded', 'extracting', 'extracted', 'failed'] }).notNull().default('uploaded'),
  extractionModel: text('extraction_model'),
  extractionTokensUsed: integer('extraction_tokens_used'),
  extractionError: text('extraction_error'),
  uploadedBy: text('uploaded_by').notNull(),
  uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),
});

export const activities = pgTable('activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  programmeId: uuid('programme_id').notNull().references(() => programmes.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),        // e.g. "NOS09-DES-1820" or MSP row "12"
  wbsPath: text('wbs_path'),                // e.g. "1.1.2"
  name: text('name').notNull(),
  description: text('description'),
  startDate: date('start_date'),
  finishDate: date('finish_date'),
  remainingDurationDays: integer('remaining_duration_days'),
  totalFloatDays: integer('total_float_days'),
  predecessorIds: jsonb('predecessor_ids').$type<string[]>(),
  resource: text('resource'),
  byOthers: boolean('by_others').default(false),
  category3: boolean('category_3').default(false),
  activityType: text('activity_type', { enum: ['task', 'milestone', 'summary'] }).notNull().default('task'),
  rawJson: jsonb('raw_json'),
});

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  activityId: uuid('activity_id').references(() => activities.id), // nullable — some tasks are manually added
  title: text('title').notNull(),
  description: text('description'),
  startDate: date('start_date'),
  dueDate: date('due_date'),
  assigneeId: text('assignee_id'), // Auth.js user id
  createdBy: text('created_by').notNull(),
  status: text('status', { enum: ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] }).notNull().default('todo'),
  blockerNote: text('blocker_note'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskComments = pgTable('task_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: uuid('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const lookaheadWindows = pgTable('lookahead_windows', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  windowStart: date('window_start').notNull(),
  windowEnd: date('window_end').notNull(),
  publishedBy: text('published_by').notNull(),
  publishedAt: timestamp('published_at').defaultNow().notNull(),
});
```

**Access control.** Implement `assertMembership(userId, organizationId)` helper in `src/lib/auth-helpers.ts`. Call from every server action / route handler that touches org-scoped data. Don't rely on client-side filtering.

---

## 5. File structure

```
lookahead/
├── AGENTS.md                   # Next.js 16 warning
├── BRIEF.md                    # Product brief (product context, not tech)
├── CLAUDE.md                   # This file
├── BUILD_PROMPT.md             # The prompt Billy pastes into a new Claude Code session
├── README.md                   # Basic dev + deploy instructions
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── drizzle.config.ts
├── vercel.json                 # Copy from cheesmans-classic; add X-Robots-Tag: noindex during beta
├── .env.local.example
├── .gitignore                  # Include .vercel/, .env.local, node_modules/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, auth provider, theme
│   │   ├── page.tsx            # Landing page (public)
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── (app)/              # Protected group
│   │   │   ├── layout.tsx      # Auth guard + nav
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── orgs/[orgSlug]/
│   │   │   │   ├── projects/[projectId]/
│   │   │   │   │   ├── page.tsx             # Project overview
│   │   │   │   │   ├── upload/page.tsx       # Upload programme
│   │   │   │   │   ├── programmes/[programmeId]/review/page.tsx  # Review AI extraction
│   │   │   │   │   ├── lookahead/page.tsx   # Current lookahead
│   │   │   │   │   └── tasks/[taskId]/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   │   └── my-tasks/page.tsx            # Personal to-do view (mobile-first)
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── programmes/upload/route.ts   # File upload
│   │       ├── programmes/[id]/extract/route.ts  # Kick off extraction (async)
│   │       ├── lookahead/generate/route.ts  # Generate tasks from activities
│   │       └── tasks/[id]/route.ts
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── programmes/
│   │   │   ├── UploadDropzone.tsx
│   │   │   └── ExtractionPreview.tsx
│   │   ├── lookahead/
│   │   │   ├── WindowPicker.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   └── GenerateButton.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskDetailDrawer.tsx
│   │   │   ├── AssigneePicker.tsx
│   │   │   └── StatusBadge.tsx
│   │   └── dashboard/
│   │       ├── OwnerDashboard.tsx
│   │       └── TeamMemberView.tsx
│   ├── db/
│   │   ├── index.ts            # Drizzle client
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── lib/
│   │   ├── anthropic.ts        # Claude API client
│   │   ├── auth.ts             # Auth.js config
│   │   ├── auth-helpers.ts     # assertMembership, getCurrentUser
│   │   ├── pdf/
│   │   │   ├── extract-text-layer.ts   # pdf.js text extraction
│   │   │   ├── parse-msp-export.ts     # Heuristics for MSP PDF pattern
│   │   │   ├── parse-p6-export.ts      # Heuristics for P6 PDF pattern
│   │   │   └── vision-fallback.ts      # Claude vision for raster PDFs
│   │   ├── lookahead/
│   │   │   ├── select-activities.ts    # Pick activities for window
│   │   │   ├── translate-task.ts       # Claude prompt to turn activity → site task
│   │   │   └── prompts.ts              # Prompt library with NOS/HS2 examples
│   │   ├── blob.ts             # Vercel Blob helpers
│   │   ├── email.ts            # Resend helpers
│   │   └── types.ts
│   └── middleware.ts           # Auth.js middleware for protected routes
├── scripts/
│   └── parse-msp-xml.ts        # Internal CLI to parse .mpp/.xer XML
└── public/
    └── (favicon etc)
```

---

## 6. MVP scope — Phase 1 only

**Commit after Phase 1:** a working Next.js 16 + Neon + Auth.js app deployed to Vercel at `lookahead.local` (or the final domain once bought) where a user can:

1. Sign up (email/password + Google SSO)
2. Create an organisation
3. Create a project
4. Invite teammates to the org (email invite via Resend — accept flow hits a token-protected route)

That's it for Phase 1. Nothing more. Do not start programme upload in Phase 1.

**Explicitly out of scope in Phase 1:**
- PDF upload or parsing (Phase 2)
- Task CRUD (Phase 3)
- AI translation (Phase 3)
- Dashboards (Phase 3)
- Stripe billing (Phase 6)
- Mobile-specific views (Phase 4)

**Deliverables for Phase 1:**
- [ ] Repo committed, pushed to GitHub
- [ ] Schema migrated to Neon (use a Neon dev branch)
- [ ] Auth.js working end-to-end (sign up, log in, log out, session persistence)
- [ ] Org CRUD (create, rename, list)
- [ ] Project CRUD within an org
- [ ] Invite flow (send token link via Resend; accept creates membership)
- [ ] Basic nav + protected routes via middleware
- [ ] Deployed to Vercel with preview URL + `X-Robots-Tag: noindex`
- [ ] README.md with dev + deploy instructions

**Phase 1 exit:** Billy can sign up, create an org called "Pang & Chiu", create a project called "NOS09", invite his own second email as a member, and see both in the dashboard.

See `BRIEF.md` §6 for Phase 2–5.

---

## 7. Environment variables

`.env.local.example`:

```
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (Neon)
DATABASE_URL=

# Auth.js
AUTH_SECRET=                     # openssl rand -base64 32
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_TRUST_HOST=true             # for Vercel preview deploys

# Email (Resend)
RESEND_API_KEY=
EMAIL_FROM="Lookahead <hello@lookahead.tld>"

# Anthropic (used from Phase 2+)
ANTHROPIC_API_KEY=

# Vercel Blob (used from Phase 2+)
BLOB_READ_WRITE_TOKEN=
```

---

## 8. Phase 2 notes — programme ingestion (do not build until Phase 1 ships)

Billy's two real-world PDFs have been feasibility-tested and both extract cleanly via text-layer parsing. Handle these two patterns first.

**Pattern A — MS Project "Gantt Chart" PDF export**
Example: `A295142-PGM-002-01 COWI NOS 09 DD Programme.mpp`, 3 pages A4.
Left-panel columns: ID · Task Mode · Task Name · Duration · Start · Finish · Predecessors · By Others · Category 3.
Dates in `DD/MM/YY` format. WBS implicit from indentation + hierarchical IDs like `1.1`, `1.1.2`. Bar chart on the right can be ignored.

**Pattern B — Primavera P6 "Classic Schedule" PDF export**
Example: `NOS09 - Interim Works Order - Contract Programme Draft 260424.pdf`, 8 pages A3.
Left-panel columns: Activity ID · Activity Name · Remaining Duration · Start · Finish · Total Float.
Activity IDs prefixed like `NOS09-KM-1190`, `NOS09-DES-3110`. Dates in `DD-MMM-YY` format, suffixed with `A` for actual (e.g. `21-Apr-26 A`). Summary rows carry WBS grouping and appear bolded with no activity ID. An asterisk on the date indicates a constrained date.

**Extraction strategy.**
1. Use `pdfjs-dist` to extract text layer. If the text layer is empty or sparse, fall back to vision.
2. Detect pattern A vs B by regex on column headers on page 1.
3. Parse row-by-row into `activities` rows. Store the raw row as `rawJson` for debugging.
4. Show the user a preview screen (`ExtractionPreview.tsx`) with editable grid before confirming — critical for trust.
5. Only after user confirms, commit to `activities` table.

**Vision fallback.**
If text-layer returns <20 rows but PDF has >1 page, assume raster. Send page images to Claude Sonnet 4.6 vision with a structured-extraction prompt. Cache per file hash.

Detailed prompts go in `src/lib/lookahead/prompts.ts` — start empty and build the library from real examples during Phase 3.

---

## 9. Phase 3 notes — lookahead generation (do not build until Phase 2 ships)

**Algorithm for `src/lib/lookahead/select-activities.ts`:**

Given a `projectId`, a `windowStart` date, and a window length (2 or 4 weeks):

1. Fetch all activities for the project.
2. Include an activity if **any** of the following is true:
   - It's a `milestone` with date in `[windowStart, windowEnd]`.
   - Its `finishDate` falls in `[windowStart, windowEnd]`.
   - Its `startDate` falls in `[windowStart, windowEnd]`.
   - It's actively in progress: `startDate <= windowEnd` AND `finishDate >= windowStart`.
3. Exclude `activity_type = 'summary'` rows (they're groupings, not work).
4. Exclude `by_others = true` activities from the PM's own task list but include them in a separate "Waiting on" section of the UI.
5. Sort by `startDate` ascending, then by `totalFloatDays` ascending (critical items surface first).

**Translation prompt** (`src/lib/lookahead/translate-task.ts`, rough shape):

```
You are translating a programme activity into a site-level task.

Activity: {name}
WBS: {wbsPath}
Start: {startDate}
Finish: {finishDate}
Resource: {resource}
Duration: {duration}

Write a task title of ≤10 words in plain site-team English. Avoid planner jargon (no "AIP", no "CE-015" — expand or drop). Prefer imperative verbs ("Complete", "Submit", "Review"). If the activity is a review by a stakeholder, name the stakeholder. Example in / example out pairs follow.
```

Build the prompt library iteratively. Log every accepted output as a training example for future prompts.

---

## 10. Setup instructions (for the Claude Code agent doing Phase 1)

1. Read this file, `AGENTS.md`, and `BRIEF.md` in full before writing code.
2. Read `node_modules/next/dist/docs/app-router.mdx` (or whatever the Next.js 16 router doc is called — it's different from what you were trained on).
3. Clone scaffold from `C:\Users\kpang\.claude\codes\CMM Got Talent Voting`:
   - Copy `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `drizzle.config.ts`, `src/app/layout.tsx`, `src/db/index.ts` structure as a starting point.
   - **Do not copy** the CMM Got Talent auth (bcryptjs) — we're using Auth.js v5 here.
4. Install Auth.js v5 with the Drizzle adapter:
   ```bash
   npm i next-auth@beta @auth/drizzle-adapter
   ```
5. Add shadcn/ui (init + add button, card, input, dropdown-menu, sheet, dialog, table, form).
6. Create Neon dev branch, put its connection string in `.env.local`, run `npm run db:push` to apply schema.
7. Wire Auth.js with email/password (credentials provider + password hash via `@node-rs/argon2`) and Google OAuth.
8. Build Phase 1 pages in order: `/signup` → `/login` → `(app)/dashboard` → org CRUD → project CRUD → invite flow.
9. Deploy to Vercel. Add `lookahead.tld` (placeholder domain) — Billy will buy the real domain and wire DNS per his standard playbook.
10. Open a PR for each logical unit of work. Do not push directly to main.

**When in doubt, ask Billy before invention.** Specifically ask about: copy (button labels, email body text), colour palette, logo. Don't guess at those.

**Tone.** This is a commercial SaaS, not an internal tool. Interface copy should feel professional — closer to Linear than Monday. Avoid emoji, avoid cheerful exclamation marks.

---

## 11. Development commands

```bash
npm run dev              # Next.js dev server
npm run build            # Production build
npm run lint             # Lint
npm run type-check       # TypeScript (if added to package.json)
npm run db:generate      # Drizzle — generate migration from schema
npm run db:push          # Drizzle — push schema to DB (dev only)
npm run db:studio        # Drizzle — open web UI
npm run db:seed          # Seed script (empty in Phase 1)
```

---

## 12. Success criteria for Phase 1

You are done with Phase 1 when:

- [ ] Billy can sign up at the production URL with email/password
- [ ] He can alternatively sign up with Google
- [ ] He can create an org, a project, and invite a member by email
- [ ] Invited member receives a Resend email, clicks the link, lands signed in as a member of that org
- [ ] The dashboard shows his orgs and projects; clicking a project shows a placeholder "Phase 2 will go here" page
- [ ] All routes behind `(app)` require auth; unauth users redirect to `/login`
- [ ] Vercel deploy is green; `X-Robots-Tag: noindex` is set; no console errors on first load
- [ ] README.md documents `npm install`, `npm run dev`, env var setup, and `npx vercel --prod`

Report to Billy with a screencast or screenshots when complete.

---

*End of spec v1.0*
