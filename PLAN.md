# Mentorship Portal — Phase 1 Plan

Add a role-based mentorship portal on top of the existing TaXing Web site with three identities: **admin**, **mentor**, **mentee**. Phase 1 covers admin roster import, login, profile setup, a mentor/mentee directory board, a bulletin board, and an admin progress tracker.

**Build order:** We build an **interactive hi-fi prototype first** — features C/D/E/F (directory, profiles, bulletin board, admin import, progress tracker) on mock data with a fake account switcher, no auth — so the team can click through and give feedback. **Auth + magic-link login and live Supabase data come afterward** (Phase B), swapping the mock layer for real queries.

**Mentor↔mentee matching is intentionally deferred** to a later phase, because first-come-first-serve under concurrency needs an atomic, server-enforced flow that we want to design carefully.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Frontend | Existing Next.js 15 + MUI + React Query | No change |
| Hosting | **Vercel** (move from GitHub Pages) | Needed for server routes, auth callbacks, secrets |
| Auth | Supabase Auth — magic-link email | No passwords to manage; admin pre-creates accounts |
| Database | Supabase Postgres + Row Level Security (RLS) | One service for auth + DB; free tier fits our scale |
| Storage | Supabase Storage (bucket: `avatars`) | Keeps Postgres lean |
| Email (invites) | Supabase default SMTP, with Resend free tier for bulk invite blast | Avoids throttling on the one-time 600-person send |

**Estimated cost at ~300 mentors + ~300 mentees per program: $0/month.** Only optional spend is a custom domain (~$10–15/year).

---

## Data model (Postgres)

1. **`profiles`** — one row per user.
   - `id` (uuid, FK `auth.users`), `role` ('admin'|'mentor'|'mentee'), `cohort_ids` (uuid[] — a user can belong to multiple cohorts across program runs), `full_name`, `email`, `bio`, `background`, `interests` (text[]), `goals`, `linkedin`, `avatar_url`, `visible` (bool), `created_at`, `updated_at`.
2. **`cohorts`** — one row per program run.
   - `id`, `name`, `starts_at`, `ends_at`, `bulletin_open` (bool), `created_at`.
3. **`roster_invites`** — pending imports before first login.
   - `id`, `cohort_id`, `email`, `full_name`, `role`, `invited_at`, `claimed_user_id` (nullable). Maps magic-link signups back to the imported role.
4. **`bulletin_posts`**
   - `id`, `cohort_id`, `author_id`, `category` ('wish'|'thanks'|'growth'|'other'), `body`, `created_at`, `hidden` (bool, admin moderation).
5. **`sessions_log`** — admin-tracked completed mentorship sessions.
   - `id`, `cohort_id`, `mentor_id`, `mentee_id`, `session_date`, `notes`, `created_by` (admin id), `created_at`.

### RLS summary
- `profiles`: a user in a **shared cohort** (array overlap) can `SELECT` rows where `visible = true`; users `UPDATE` only their own row; admins can do anything.
- `bulletin_posts`: same-cohort `SELECT` of non-hidden rows; authenticated users `INSERT` as themselves; only author or admin can `UPDATE`/`DELETE`; admins toggle `hidden`.
- `sessions_log`: read by mentor/mentee involved; write only by admins (enforced server-side via service role).
- `roster_invites`: admin only.

---

## Routes & UI surface

| Route | Purpose |
|---|---|
| `/portal/login` | Magic-link email form |
| `/portal/onboarding` | First-login profile setup, prefilled from `roster_invites` |
| `/portal/me` | Edit own profile + "My sessions" widget |
| `/portal/directory` | Paginated, filterable board with Mentors / Mentees tabs |
| `/portal/board` | Bulletin board: list + composer, filter by category |
| `/portal/admin` | Admin home (gated by `role = 'admin'`) |
| `/portal/admin/import` | CSV upload for mentor/mentee roster |
| `/portal/admin/sessions` | Log/edit completed sessions, per-pair counters |
| `/portal/admin/moderation` | Hide/unhide bulletin posts |

Server-only Next.js Route Handlers under `src/app/api/admin/*` for actions that require the service-role key (CSV import, session logging, moderation toggle). All other reads/writes use the browser Supabase client gated by RLS.

AppBar gains a **Portal** link and a sign-in/avatar menu when authenticated.

---

## Steps (phased)

### Phase 0 — Move hosting to Vercel ✅ *(done — site live on Vercel)*
1. ✅ Remove GitHub Pages–specific settings from `next.config.ts` (`output: 'export'`, `basePath`, `images.unoptimized`). Config is now empty; image components fall back to `NEXT_PUBLIC_BASE_PATH || ''`, which is correct for a root-domain Vercel deploy.
2. ✅ Imported `TaXingWeb` into Vercel; deployed.
3. ✅ Verified the `*.vercel.app` URL renders the site.
4. GitHub Pages: disable once Vercel is fully verified. Re-point DNS later if a custom domain is added. *(user follow-up)*
5. Preview deploys confirmed via branch pushes. *(user follow-up)*

### Phase A — Backend foundation ✅ *(code complete; live Supabase deferred until after the prototype)*
6. ⏳ **Deferred until Phase B (real-data wiring):** Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel + `.env.local`. Template in `.env.example`. **Not needed for the prototype** — the prototype runs entirely on mock data with no backend.
7. ✅ SQL migration written: `supabase/migrations/0001_init.sql` — five tables, enums, indexes (GIN on `profiles.cohort_ids`, `bulletin_posts(cohort_id, created_at)`, `sessions_log.mentor_id`, `sessions_log.mentee_id`, `roster_invites(lower(email))`), `is_admin()`/`current_cohort_ids()` helpers, RLS policies, and an `updated_at` trigger. Ready to run when we wire real data.
8. ✅ Installed `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `papaparse` (+ `@types/papaparse`). Added `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (cookie-scoped + service-role), `src/lib/auth.ts` (`getCurrentUser()` + `requireRole()`), and `src/types/portal.ts` (shared types).

### Phase P — Interactive hi-fi prototype *(NEXT — mock data, no auth; goal: shareable clickable demo for team feedback)*

**Why first:** Validate the C/D/E/F feature set with the team before investing in auth, magic-link email, and live data. The prototype is fully interactive but backed by an in-browser mock store, so there's nothing to log into and no secrets to configure. Everything is built against a thin **data-access layer** so Phase B can swap mocks for Supabase without rewriting the UI.

9. **Mock data + data-access seam.** Add `src/lib/portal/mockData.ts` with a realistic seed: one cohort, ~8–12 mentors and ~8–12 mentees (names, bios, interests, LinkedIn, avatars via placeholder service), a handful of bulletin posts across all categories, and several logged sessions. Reuse the `src/types/portal.ts` types. Add `src/lib/portal/store.ts` — a `localStorage`-backed store (seeded from the mock data on first load, with a "reset demo data" action) exposing async CRUD functions shaped like the eventual Supabase calls (`listProfiles`, `updateProfile`, `listPosts`, `createPost`, `hidePost`, `listSessions`, `logSession`, `importRoster`, …).
10. **Fake account switcher + `<PortalShell>`.** Add a `PortalSessionProvider` (React context) holding the "logged-in as" identity, plus a small floating **dev account switcher** to jump between *Admin*, a sample *Mentor*, and a sample *Mentee* (persisted in `localStorage`). Build `<PortalShell>` (sidebar/nav + role-gated menu items) reading role from this context instead of a real session. Add a `/portal` landing page.
11. **AppBar entry.** Update `AppBar.tsx` and `data/navigation.ts` to surface a **Portal** link (no real sign-in control yet — that arrives with auth).

#### Feature D — Profiles & directory
12. Build `/portal/directory`: Mentors / Mentees tabs, search + interest filter, profile detail dialog. Reads from the mock store.
13. Build `/portal/me` profile editor (MUI form: bio, background, interests, goals, LinkedIn, avatar, visibility toggle) writing back to the mock store so edits persist across the demo.

#### Feature E — Bulletin board
14. Build `/portal/board`: post list, composer, category filter, author info, and admin hide/unhide — all against the mock store. Honor a mock `bulletin_open` flag.

#### Feature C — Admin roster import
15. Build `/portal/admin/import`: CSV uploader (columns `email,full_name,role`), client-side parse with `papaparse`, validation, and a simulated results table (added / skipped / errors). Imported rows land in the mock store so they appear in the directory — no email is sent.

#### Feature F — Admin progress tracker
16. Build `/portal/admin/sessions`: form to log a session (mentor, mentee, date, notes), recent-logs table, and a summary aggregating counts per pair and per user. Edit/delete supported, all in the mock store.
17. Add a read-only "My sessions" widget on `/portal/me`.

18. **Ship the prototype.** `npm run lint` + `npm run build`, push the branch, and share the Vercel preview URL with the team for feedback. Collect notes before starting Phase B.

### Phase B — Real auth & data wiring *(after prototype feedback; replaces the mock seam with Supabase)*
19. Create the Supabase project and run `0001_init.sql` (Phase A step 6/7). Wire env vars.
20. Build `/portal/login` with Supabase magic link. On callback, look up `roster_invites` by email; if found, create the `profiles` row with the imported role and link `claimed_user_id`.
21. Replace `src/lib/portal/store.ts` mock implementations with real Supabase queries (same function signatures), and swap `PortalSessionProvider` for a real session/role context. Remove the dev account switcher (or gate it to non-prod).
22. Make `/portal/onboarding` (first-login profile setup, prefilled from `roster_invites`) and move avatar upload to Supabase Storage.
23. Move admin write actions (import, session logging, moderation) into server-only Route Handlers under `src/app/api/admin/*` using the service-role key. Add a real sign-in/avatar control to the AppBar.

### Phase G — Hardening
24. Zod-validate every Route Handler input.
25. Rate-limit bulletin posts (per user per minute).
26. Add CSV import dry-run mode.
27. Manual QA pass + `npm run lint` + `npm run build`.

---

## Files to add or modify

**Prototype (Phase P) — mock data, no backend:**
- `src/lib/portal/mockData.ts` — seed cohort, mentors, mentees, posts, sessions *(new)*.
- `src/lib/portal/store.ts` — `localStorage`-backed data-access layer with Supabase-shaped function signatures *(new)*.
- `src/components/portal/PortalSessionProvider.tsx` — fake "logged-in as" context + dev account switcher *(new)*.
- `src/components/portal/PortalShell.tsx` — portal layout + role-gated nav *(new)*.
- `src/app/portal/**` — portal routes: `/portal`, `/portal/directory`, `/portal/me`, `/portal/board`, `/portal/admin/import`, `/portal/admin/sessions` *(new)*.
- `src/components/common/AppBar.tsx` and `src/data/navigation.ts` — add Portal entry.

**Already done (Phase A):**
- `package.json` — added `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `papaparse`. ✅
- `next.config.ts` — stripped GitHub Pages settings. ✅
- `supabase/migrations/0001_init.sql` — schema + RLS. ✅
- `src/lib/supabase/{client,server}.ts` — Supabase clients. ✅
- `src/lib/auth.ts` — `getCurrentUser`, `requireRole`. ✅
- `src/types/portal.ts` — shared TS types. ✅
- `.env.example` — Supabase key template. ✅

**Real-data wiring (Phase B):**
- `.env.local` (gitignored) — Supabase keys.
- `src/app/portal/login` + `onboarding` — magic-link auth and first-login setup *(new)*.
- `src/app/api/admin/{import,sessions,moderation}/route.ts` — service-role route handlers *(new)*.
- Swap `src/lib/portal/store.ts` internals to Supabase; replace fake session provider with real session/role context; add sign-in/avatar control to AppBar.

---

## Verification

**Prototype (Phase P) — clickable demo, mock data:**
1. Use the dev account switcher to view the portal as Admin, Mentor, and Mentee; nav items are role-gated.
2. Directory: browse Mentors/Mentees tabs, search/filter, open a profile dialog.
3. Edit own profile on `/portal/me`; reload and confirm the change persisted (localStorage).
4. Bulletin board: post in each category; as Admin, hide a post and confirm it disappears for non-admin accounts; unhide restores it.
5. Admin import: upload a small CSV (`email,full_name,role`); confirm the results table and that imported people appear in the directory. (No email sent.)
6. Admin sessions: log a session; confirm the per-pair/per-user summary updates and the "My sessions" widget reflects it for those users.
7. `npm run lint` and `npm run build` pass; share the Vercel preview URL.

**Real-data wiring (Phase B):**
8. Seed one admin in Supabase; CSV-import a 300+300 fake roster; verify `roster_invites` rows and queued invite emails.
9. Log in as a mentor and a mentee via magic link; confirm `profiles` is auto-created with the right role.
10. RLS check: as a mentee, attempt to update another user's profile or `sessions_log` — must fail.

---

## Key decisions

- **Prototype-first.** Build a clickable hi-fi prototype of features C/D/E/F on mock data (no auth, no backend) to gather team feedback before committing to auth + live data. UI is built against a data-access seam so the swap to Supabase is low-risk.
- **Vercel** for hosting (GitHub Pages can't run server code or hold secrets).
- **Supabase** over a custom auth/DB stack to stay on a free tier and avoid running our own server.
- **Magic-link login** only — no passwords. *(deferred to Phase B)*
- **Admin import** is the only account-creation path; users cannot self-register.
- **Matching is out of scope** for Phase 1; will be designed later as an atomic server-enforced flow.
- **Multi-cohort from day one** via `cohort_id` so the system is reusable across programs.

---

## Open questions

1. Bilingual UI (EN/ZH) — keep portal copy in `src/data/portalCopy.ts` for Phase 1, defer i18n framework?
2. Is the directory visible to logged-out users? Recommended: **no**, login required.
3. Avatar upload size cap (suggest 1 MB) and accepted MIME types.
4. Bulletin board scope: single channel for the whole cohort, or split into mentor-only / mentee-only / mixed channels?
