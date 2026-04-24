<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lookahead — agent guidance

- `CLAUDE.md` in this folder is the authoritative spec. Read it in full before writing code.
- `BRIEF.md` has product context — read it for framing decisions but not technical detail.
- `BUILD_PROMPT.md` is the prompt Billy pastes to kick off a new build session — don't edit without asking.
- This is a **commercial SaaS**, not an internal tool. Copy and UX matter. Ask Billy for copy, colours, and brand decisions rather than guessing.
- Use **Auth.js v5**, not bcryptjs. Use **Drizzle**, not Prisma. Use **Tailwind 4 + shadcn/ui**, not MUI.
- When a decision feels ambiguous, open a short question with Billy rather than invent.
