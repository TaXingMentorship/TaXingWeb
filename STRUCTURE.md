# Project Structure Guide

How TaXing Web is organised and why. Read this before working on the portal.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · MUI v7 · React Query · Supabase (Postgres + Auth + Storage). Path alias `@/*` → `src/*`.

---

## Two apps, one Next project

### 1. Public marketing site

Routes `/`, `/about`, `/past-programs`, `/podcast`, `/join`. Static, no auth, English/bilingual.

- `src/components/sections/` — page-level sections (`HeroSection`, `VolunteersSection`, …)
- `src/components/common/` — shared UI (`AppBar`, `Card`, `SectionContainer`, `PodcastPlayer`, …)
- `src/data/` — all copy and content (`aboutContent.ts`, `volunteers.ts`, `pastPrograms.ts`, …)

**Convention:** text lives in `src/data`, not in components. For a content or design update, edit the data file first.

### 2. Mentorship portal

Routes `/portal/*`. Auth-gated, all copy in Simplified Chinese (她行 · Mentorship), backed by Supabase.

- `src/app/portal/` — pages
- `src/app/api/` — route handlers (admin operations, auth)
- `src/components/portal/` — portal components, with `board/` for the bulletin board
- `src/lib/portal/` — data access (`store.ts`, `uploads.ts`)
- `src/lib/supabase/` — client factories
- `supabase/migrations/` — schema and RLS policies

`PLAN.md` tracks the feature plan and phase status.

---

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # ESLint
npm run build    # prebuild fetches the podcast feed, then next build
npm run start    # serve the production build
```

There is no test framework. `npm run lint` + `npm run build` are the verification gate.

**Stop the dev server before running `npm run build`.** Both write to `.next`; the production build overwrites the dev server's chunks and the running server dies with `Cannot find module './NNNN.js'` while every asset 404s. Recover with `rm -rf .next` and restart `npm run dev`.

`prebuild` (`scripts/fetchPodcast.mjs`) fetches the podcast RSS feed and writes `public/podcast.json`. It retries and keeps the existing file on failure, so a feed outage does not break the build.

---

## Environment

Copy `.env.example` → `.env.local` and fill in from the Supabase dashboard (Project Settings → API). Supabase variables are required for anything under `/portal`; the marketing pages render without them.

`SUPABASE_SERVICE_ROLE_KEY` and `PORTAL_ACTIVATION_CODE` are **server-only** and must never reach a client component.

Migrations in `supabase/migrations/` are applied by hand in the Supabase SQL editor — there is no CLI migration step in the build. Apply them in filename order, and let each one commit before running the next.

### Deployment

The site runs on Vercel. **The same variables must also be set in the Vercel project, per environment** — Vercel scopes them to Production / Preview / Development separately, and Preview is the one people forget. A pull-request preview with no variables looks like this:

> Application error: a client-side exception has occurred while loading … (see the browser console for more information)

with `@supabase/ssr: Your project's URL and API key are required to create a Supabase client!` in the console. Every page fails, not just the portal, because the browser Supabase client is constructed in the shared `AppBar`.

`NEXT_PUBLIC_*` values are **inlined at build time**, so adding them to Vercel is not enough — the deployment has to be rebuilt (Redeploy) before they take effect.

`next build` succeeds without them. Only running the built app catches it:

```bash
npm run build && npm run start
```

Make that part of the check for anything deployment-related.

---

## Portal data flow

### Three Supabase clients

Picking the wrong one is the most common mistake in this codebase.

| Factory | Scope | Use for |
|---|---|---|
| `createClient()` in `src/lib/supabase/client.ts` | Browser, RLS enforced | `store.ts`, `uploads.ts` — all client-side reads and user-scoped writes |
| `createClient()` in `src/lib/supabase/server.ts` | Request-scoped, cookie-backed, RLS enforced | Server Components and Route Handlers acting *as the signed-in user* |
| `createServiceRoleClient()` in `src/lib/supabase/server.ts` | **Bypasses RLS**, server-only | Admin route handlers only |

### The `store.ts` seam

`src/lib/portal/store.ts` is the single data-access layer for the portal: async, Supabase-shaped CRUD over every table. The UI never calls Supabase directly.

- **Reads and user-scoped writes** go straight to the browser client, constrained by RLS.
- **Privileged writes** (roster/match CSV import, session logging, post and comment moderation) POST to `src/app/api/admin/*`. Those handlers validate with zod, authorize via `requireApiRole()` (`src/app/api/admin/_lib.ts`), then use the service-role client.

Keep this split: no service-role calls outside `src/app/api/**`, and new queries go in `store.ts` rather than in a page.

Errors thrown by `store.ts` are user-facing Chinese strings (`读取项目失败：…`). Admin handlers return `{ error: "…" }` with a 400/401/403 status.

---

## Auth and session

- **`src/middleware.ts`** (matches `/` and `/portal/*`) refreshes the Supabase cookie, sends unauthenticated users to `/portal/login?next=…`, sends users without a `profiles` row to `/portal/onboarding`, and forwards a `?code=` landing on `/` to `/portal/auth/callback`. The exception lists `PUBLIC_PORTAL_PATHS` and `PROFILE_OPTIONAL_PATHS` are at the top of the file.
- **`src/app/portal/layout.tsx`** resolves the user server-side via `getCurrentUser()` and seeds `PortalSessionProvider`. Client code reads `usePortalSession()` for `currentUser`, `role`, `isAdmin`, `isVolunteer`.
- **`src/lib/auth.ts`** — `requireRole()` throws `"UNAUTHENTICATED"` or `"FORBIDDEN"`; callers map that to a redirect (pages) or a status code (route handlers).
- **Invite-only.** There is no self-registration. Admins CSV-import into `roster_invites`; a user activates through `/api/auth/first-time` with `PORTAL_ACTIVATION_CODE` (compared with a timing-safe hash) and then completes onboarding.

---

## Identity model

Identity is **composable**, not a single role enum. Migration `0004_composable_roles.sql` replaced the original `role` column (parts of `PLAN.md` still describe the old shape):

- `profiles.participant_role` — `'mentor' | 'mentee' | null`
- `profiles.is_admin`, `profiles.is_volunteer` — independent booleans

So someone can be a mentor *and* an admin, or a volunteer with no participant role. `UserRole` in `src/types/portal.ts` is `'admin' | ParticipantRole`; `requireRole` resolves `'admin'` against the flag and mentor/mentee against `participant_role`.

Users belong to many seasons through `profiles.cohort_ids uuid[]` — filter with `.contains("cohort_ids", [id])`.

Mentor↔mentee `matches` are admin-uploaded. Mentors may log sessions only for matched mentees; admins are unrestricted. This is enforced both in RLS and in the sessions route handler.

`src/types/portal.ts` mirrors the database row shapes and is the contract between migrations, `store.ts` and the UI — change it in step with the migration.

---

## Seasons (cohorts)

`cohorts` is the organising axis of the whole portal: boards, roster imports, matches, session logs and participation records all carry a `cohort_id`.

Admins manage seasons at `/portal/admin/cohorts` — name, start/end dates, and the `bulletin_open` archive switch.

**There is deliberately no delete.** Eight tables cascade from `cohorts`, so removing one would wipe that season's entire history, and `profiles.cohort_ids` is a plain array that would be left holding dangling ids. Mistakes are fixed in SQL, where the destructive warning is explicit.

`listCohorts` returns newest season first (`starts_at` descending, nulls last). A season with no `starts_at` sorts to the bottom — always set the dates.

---

## Bulletin board

`/portal/board` is a single tabbed page: a season row above a board row, addressed as `?cohort=<id>&board=<id>`. The old `/portal/board/[boardId]` route only redirects into it so existing links keep working. Components live in `src/components/portal/board/`.

The wall is CSS multi-column masonry and the emoji picker is hand-rolled — no `@mui/lab`, no picker library, matching the MUI-only stack.

**Boards are configured, not hardcoded.** Each row carries `allowed_categories`, `allow_anonymous`, `allow_comments`, `prompt` and `sort_order`, so a new kind of board (feedback wall, mentor Q&A, graduation wall) is a row an admin creates, not a code change. `sort_order` has no form field — every board is created at `0` and ordering falls through to `created_at`; change it in Supabase to make a board jump the queue.

### Who can do what

| | Read | Post / comment / react |
|---|---|---|
| Own season | yes | yes, if the board and season are open |
| Other seasons | yes | **no** |

Reading is open across all seasons (migration `0008`); the insert policies still require `cohort_id = any(current_cohort_ids())`, so a non-member browses a past season read-only. The UI mirrors this with `canParticipate = canPost && (isAdmin || isMember)`. A board accepts posts only when `board.is_open && cohort.bulletin_open` — the season flag archives a whole season at once.

Since migration `0007`, RLS allows **no** client-side UPDATE on `bulletin_posts` or `bulletin_comments`. Every flag change goes through `/api/admin/moderation`, which authorizes in code: `resolved` for the post's author or an admin; `pinned`, `hidden` and all comment changes for admins only. DELETE is unchanged — authors may still delete their own posts and comments. Do not add a client-side update path for these tables; extend the route instead.

### Anonymity

Anonymity is enforced in the database, not just in the UI (migration `0009`). Clients hold no SELECT on `bulletin_posts` or `bulletin_comments`; they read `bulletin_posts_readable` / `bulletin_comments_readable`, which null out `author_id` for anonymous rows unless you are the author or an admin.

| Viewer | `author_id` on an anonymous row |
|---|---|
| Admin | real value — moderation has to stay possible |
| The author | real value |
| Anyone else | `null` |

Consequences for anyone touching this code:

- `BulletinPost.author_id` and `BulletinComment.author_id` are `string | null`. Guard before looking a profile up.
- Inserts cannot use `.select()` to read the row back — there is no SELECT privilege. Refetch through the view.
- UPDATE and DELETE go through `/api/admin/moderation`, which uses the service-role client and authorizes in code (author or admin). A client-side filtered delete is no longer possible.
- The views are SECURITY DEFINER, so they bypass RLS and **their `WHERE` clause is the entire row boundary**. If you change who may read posts, change the view, not just the policies.

`profiles` remains cohort-scoped, so an author from another season cannot be resolved even when `author_id` is present. Render that case as `pastMemberName` (「往期成员」), never as `anonymousName` — conflating them would report a named post as anonymous.

`reactionEmojis` in `portalCopy.ts` must stay in sync with the check constraint on `bulletin_reactions.emoji`.

---

## Navigation

`src/data/portalNav.ts` is the single source of truth for portal navigation — used by both the sidebar (`PortalShell`) and the landing tiles (`/portal`). Add a page once, in that array. `access` is `"all" | "participant" | "admin"`, and `canAccessPortalNav()` applies it.

Nav filtering is presentation only. Every page also checks `is_admin` itself, and RLS is the real boundary.

---

## Storage

- `avatars` — public bucket, 2 MB cap
- `participation` — private bucket, 5 MB cap, read through short-lived signed URLs

`src/lib/portal/uploads.ts` holds the size and MIME validation for both. Reuse it rather than calling `supabase.storage` directly.

---

## Styling

`src/theme.ts` is the MUI theme (light mode only). `src/app/layout.tsx` wraps the tree in `AppRouterCacheProvider` from `@mui/material-nextjs` — **do not remove it**. Without it, Emotion injects `<style>` tags inline in the server-rendered component tree that the client never produces, and hydration fails on every page.

Responsive layout is done with CSS breakpoints (`sx={{ display: { xs: 'none', md: 'flex' } }}`), not by branching on `useMediaQuery`. The hook returns `false` on the server every time, which renders the wrong variant and then corrects it on the client.

---

## Known issues

- `src/lib/portal/mockData.ts` is a leftover from the prototype phase and is no longer imported anywhere. It is still type-checked, so it has to be kept in sync with `src/types/portal.ts` until it is deleted.
- `.github/workflows/pages.yml` still builds for GitHub Pages and uploads `out/`, which the current config does not produce. The site deploys on Vercel; the workflow is stale.
- The season badge in the portal sidebar (`portalCopy.prototypeBadge`) is a hardcoded string, not live data.
