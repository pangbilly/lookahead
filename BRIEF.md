# Programme Lookahead — Product Brief

*Working title. Prepared for Billy Kin Pang · 24 April 2026 · Status: draft v0.2 (post feasibility test)*

---

## 1. Executive summary

**Context.** Construction programmes — Primavera P6, MS Project, complex Excel, Gantt PDFs — are the authoritative source of truth on major infrastructure jobs. But the people doing the work (foremen, site engineers, trades leads) can't use them. Programmes are produced by planners, for planners, and the site sees a wall of 1,500 interlinked activities. The gap is filled manually today: someone writes a 2-week lookahead on a whiteboard or a spreadsheet.

**Issue.** That manual translation is slow, error-prone, disconnected from the master programme, and not tracked back when site delivery slips. Tools in the market are either generic task managers (Monday, ClickUp, Asana), heavy PM platforms (Procore), or specialist lean-construction consultant tools (Touchplan, vPlanner). **None of them ingest the master programme and translate it into site-usable tasks with AI.**

**Recommendation.** Build a commercial SaaS — **"Programme Lookahead"** (working name) — that ingests a construction programme (PDF first per Billy's call; then Excel, MS Project, Primavera P6), uses Claude to extract and translate activities into a clean 2-week or 4-week lookahead of plain-English tasks, lets a programme manager assign them to named team members, and exposes a monitoring dashboard of who's doing what. MVP aimed at UK construction SMEs.

**Feasibility — validated 24 Apr 26.** Claude successfully extracted clean structured data from both of Billy's real-world PDFs (COWI/NOS09 MS Project export and Barhale/NOS09 Primavera P6 export). Activity IDs, names, durations, starts, finishes, float, and WBS hierarchy all came through as text, not requiring vision-model interpretation. **PDF-first is viable for the MSP/P6-export format that dominates the UK SME market.**

**Next step.** Sign off name, domain, and MVP scope. Stand up the Next.js 16 + Neon + Drizzle scaffold (cloning from `CMM Got Talent Voting`), wire Claude API for PDF extraction, write a first-pass parser that handles the two PDF patterns Billy already has on file, then produce lookaheads from his live NOS09 programme as the walking-skeleton demo.

---

## 2. Decisions captured from Billy

| Decision | Value |
|---|---|
| Target customer | **Commercial SaaS for construction SMEs** |
| MVP ingest | **PDF first** — validated as feasible on MSP/P6-export pattern |
| Translation approach | **AI-assisted** — LLM extracts + translates, user reviews + edits, then publishes |
| Assignment model | **Flat** — PM → named individuals. Hierarchy comes later. |

---

## 3. Product positioning

**One-line pitch.** *"Upload your programme. Get a lookahead your site team can actually use. Track who's doing what — without touching Primavera again."*

**Who buys.** UK construction SMEs — tier-2 and tier-3 contractors (£5m-£100m turnover) who are expected to deliver against a client's Primavera programme but don't have a planner full-time. Think MEP subbies, civils contractors, fit-out firms, façade specialists. Also tier-1 delivery teams (like Barhale on NOS) who want a better way to cascade the programme to site.

**Two personas in the MVP.**
- **Programme manager / owner** — uploads the programme, reviews AI-extracted tasks, assigns to team, sees the dashboard.
- **Team member** — sees their personal to-do list (today, this week, next week), marks tasks done, raises blockers.

**Competitive frame.**

| Competitor | What they do | Where we win |
|---|---|---|
| Monday.com / Asana / ClickUp | Generic task management | We start from the master programme, not a blank board |
| Procore | Full construction PM suite | We're cheaper, lighter, and focused on the lookahead flow |
| Touchplan / vPlanner | Lean construction lookahead boards | We ingest the real programme with AI, not manual entry |
| Primavera / MS Project | Planning, not doing | We translate into site language and assign |

**Pricing model (indicative — model properly later).**
- Solo (£15/mo) — 1 user, 1 active programme
- Team (£49/user/mo) — up to 10 users, unlimited programmes, shared org
- Contractor (£POA) — unlimited users, SSO, custom onboarding, invoicing

---

## 4. Recommended stack

Fits Billy's **Next.js 16 + Neon/Drizzle** family (stack family 2). Clone scaffold from `CMM Got Talent Voting`.

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind 4) | Billy's default |
| Database | Neon Postgres + Drizzle ORM | Serverless, cheap, already scripted |
| Auth | Auth.js v5 (NextAuth) with Neon adapter | SaaS-ready, supports SSO, billing-ready |
| UI | Tailwind 4 + shadcn/ui | Ships production-feel UI fast |
| AI | Claude Sonnet 4.6 via Anthropic API | Text extraction + vision fallback + translation |
| File parse | pdf.js text-layer extraction first; Claude vision fallback for raster/scanned. Later SheetJS + mpxj | Text-layer path handles 80-90% cheaply |
| Email | Resend | Dead-simple transactional |
| Payments | Stripe (Phase 2) | UK-friendly, handles VAT |
| Hosting | Vercel + Billy's deploy playbook | Proven |
| Monitoring | Sentry + PostHog (Phase 2) | Errors + analytics |

---

## 5. Data model (first cut)

```
organizations              (tenant)
users                      (Auth.js)
organization_members       (user ↔ org, role)
projects                   (per org)
programmes                 (uploaded file + extraction metadata)
activities                 (raw extraction — WBS, dates, predecessors, float)
tasks                      (human-edited, assignable, status)
task_comments              (blockers + notes)
lookahead_windows          (published 2/4-wk windows)
```

Row-level policies filter everything by `organization_id` via membership.

---

## 6. MVP build phases — 8–10 weeks to private beta

**Phase 1 (w1-2) Foundations** — scaffold, auth, org + project CRUD, deploy

**Phase 2 (w3-4) Ingest + extract** — PDF upload, text-layer parser for MSP/P6 exports, vision fallback, internal CLI for .mpp/.xer, preview screen

**Phase 3 (w5-6) Lookahead + tasks** — window generator, AI translation, task list, assignment, status, owner dashboard

**Phase 4 (w7-8) Operational polish** — mobile personal view, email notifications, blocker comments, PDF/CSV export, role management

**Phase 5 (w9-10) Private beta** — 3–5 friendly SMEs, feedback loop, fix top 10

**Phase 6+** — Stripe, native MSP/P6/Excel, PWA, slippage alerts, integrations

---

## 7. Naming

Recommendation: **Lookahead** — industry-native, owns the category name.
Alternatives: Programme Pulse, Focal, Weekmap, SitePlan, Cascade, FrontLine.

---

## 8. Key risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | PDF edge cases (raster-Gantt, scanned) | Medium (revised from High) | MSP/P6 export pattern validated; vision fallback; preview required |
| 2 | Claude token costs at scale | Medium | Cache per file hash; prefer text-layer; tier pricing |
| 3 | Translation quality (AI slop) | Medium | Always-edit step; prompt library with NOS/HS2 examples |
| 4 | Feature creep towards Monday.com | High | Ruthless MVP discipline until 10 paying customers |
| 5 | GDPR / data residency | Medium | UK Neon region; DPA in ToS |
| 6 | Commercial structure (entity, VAT) | Medium | Under P&C for beta; spin new entity if traction |
| 7 | Billy bandwidth alongside HS2 + Pho + KXMC + YaHua + Tunnel Tycoon | High | See §11 |

---

## 9. Reusable pieces from Billy's kit

| Reuse | From |
|---|---|
| Full Next.js/Drizzle/Neon/admin/API scaffold | `CMM Got Talent Voting` |
| `vercel.json` security headers | `cheesmans-classic/vercel.json` |
| Deploy + DNS workflow | `_deploy-prompt-template.md` + memory playbook |
| AGENTS.md Next.js-16 warning | Every Next.js project |
| CLAUDE.md spec template | `temp/fever-tracker/CLAUDE.md` |

Approx **40–50% of initial scaffold already written** across existing projects.

---

## 10. Feasibility evidence — 24 Apr 26 test

### PDF 1 — A295142-PGM-002-01 COWI NOS 09 DD (MS Project export)
3 pages A4, **217 rows** extracted cleanly.
Columns recovered: ID · Task Mode · Name · Duration · Start · Finish · Predecessors · By Others · Category 3.
WBS hierarchy intact. Milestones detected. Predecessor linkage recovered.

### PDF 2 — NOS09 Interim Works Order (Primavera P6, Barhale)
8 pages A3, **~250 activities** extracted cleanly.
Columns recovered: Activity ID · Name · Remaining Duration · Start · Finish · Total Float.
Summary hierarchy preserved. Actuals vs planned recognisable. Float captured.

### Sample — NOS09 2-week lookahead (24 Apr – 8 May 26)
~20 assignable tasks emerged across design deliverables, on-site surveys, NR Week-06 possession (9-11 May), material testing, and OFWAT by-others updates.

**Implication.** PDF-first is defensible on evidence. Walking-skeleton demo on real NOS09 data achievable by Week 4 of build.

---

## 11. Questions for Billy before starting code

1. Name — "Lookahead" or brainstorm?
2. Commitment level — major Q2/Q3 push, or side project?
3. A specific friendly SME to design for first?
4. Branding direction — friendly (Monday) or heavyweight (Procore)?
5. Spin up the repo today, or refine the brief first?

---

*End of brief v0.2*
