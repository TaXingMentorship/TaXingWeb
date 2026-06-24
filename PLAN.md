# Mentorship Portal — Phase 1 Plan

Add a role-based mentorship portal on top of the existing TaXing Web site with three identities: **admin**, **mentor**, **mentee**. Phase 1 covers admin roster import, login, profile setup, a mentor/mentee directory board, a bulletin board, and an admin progress tracker.

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
   - `id` (uuid, FK `auth.users`), `role` ('admin'|'mentor'|'mentee'), `cohort_id`, `full_name`, `email`, `bio`, `background`, `interests` (text[]), `goals`, `linkedin`, `avatar_url`, `visible` (bool), `created_at`, `updated_at`.
2. **`cohorts`** — one row per program run.
   - `id`, `name`, `starts_at`, `ends_at`, `bulletin_open` (bool), `created_at`.
3. **`roster_invites`** — pending imports before first login.
   - `id`, `cohort_id`, `email`, `full_name`, `role`, `invited_at`, `claimed_user_id` (nullable). Maps magic-link signups back to the imported role.
4. **`bulletin_posts`**
   - `id`, `cohort_id`, `author_id`, `category` ('wish'|'thanks'|'growth'|'other'), `body`, `created_at`, `hidden` (bool, admin moderation).
5. **`sessions_log`** — admin-tracked completed mentorship sessions.
   - `id`, `cohort_id`, `mentor_id`, `mentee_id`, `session_date`, `notes`, `created_by` (admin id), `created_at`.

### RLS summary
- `profiles`: anyone in the same cohort can `SELECT` rows where `visible = true`; users `UPDATE` only their own row; admins can do anything.
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

### Phase A — Backend foundation ✅ *(code complete; awaiting Supabase project + env values)*
6. ⏳ **User action:** Create a Supabase project. Store `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel env vars (and `.env.local` for dev). Template provided in `.env.example`.
7. ✅ SQL migration written: `supabase/migrations/0001_init.sql` — five tables, enums, indexes (`profiles.cohort_id`, `bulletin_posts(cohort_id, created_at)`, `sessions_log.mentor_id`, `sessions_log.mentee_id`, `roster_invites(lower(email))`), `is_admin()`/`current_cohort_id()` helpers, RLS policies, and an `updated_at` trigger. Run it in the Supabase SQL editor (or via the Supabase CLI).
8. ✅ Installed `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `papaparse` (+ `@types/papaparse`). Added `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (cookie-scoped + service-role), `src/lib/auth.ts` (`getCurrentUser()` + `requireRole()`), and `src/types/portal.ts` (shared types).

### Phase B — Auth & roles *(depends on A — NEXT)*
9. Build `/portal/login` with Supabase magic link. On callback, look up `roster_invites` by email; if found, create the `profiles` row with the imported role and link `claimed_user_id`.
10. Build a `<PortalShell>` layout wrapping all `/portal/*` pages: session check, redirect, role context.
11. Update `AppBar.tsx` and `data/navigation.ts` to surface the portal entry and a sign-in/avatar control.

### Phase C — Admin roster import *(depends on B)*
12. Build `/portal/admin/import`: CSV uploader (columns `email,full_name,role`). Parse client-side, POST to `/api/admin/import` which validates with Zod, upserts `roster_invites`, optionally triggers Supabase Auth invite emails.
13. Show import results table (added / skipped / errors).

### Phase D — Profiles & directory *(depends on B; parallel with C)*
14. Build `/portal/onboarding` and `/portal/me` profile editor (MUI form, avatar upload to Supabase Storage).
15. Build `/portal/directory` with mentor/mentee tabs, search, profile detail dialog. React Query for fetching.

### Phase E — Bulletin board *(depends on B; parallel with C/D)*
16. Build `/portal/board`: paginated post list, composer, category filter, author info, admin hide/unhide. Respect `cohorts.bulletin_open`.

### Phase F — Admin progress tracker *(depends on B)*
17. Build `/portal/admin/sessions`: form to log a session (mentor, mentee, date, notes), recent logs table, summary view aggregating `count(*) per (mentor_id, mentee_id)` and per user. Edit/delete supported.
18. Add a read-only "My sessions" widget on `/portal/me`.

### Phase G — Hardening
19. Zod-validate every Route Handler input.
20. Rate-limit bulletin posts (per user per minute).
21. Add CSV import dry-run mode.
22. Manual QA pass + `npm run lint` + `npm run build`.

---

## Files to add or modify

- `package.json` — add `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `papaparse`.
- `.env.local` (gitignored) — Supabase keys.
- `next.config.ts` — strip GitHub Pages settings.
- `supabase/migrations/0001_init.sql` — schema + RLS *(new)*.
- `src/lib/supabase/{client,server}.ts` — Supabase clients *(new)*.
- `src/lib/auth.ts` — `getCurrentUser`, `requireRole` *(new)*.
- `src/app/portal/**` — all portal routes *(new)*.
- `src/app/api/admin/{import,sessions,moderation}/route.ts` — admin route handlers *(new)*.
- `src/types/portal.ts` — shared TS types *(new)*.
- `src/app/layout.tsx` — wrap with a Supabase session provider.
- `src/components/common/AppBar.tsx` and `src/data/navigation.ts` — add Portal entry and auth menu.

---

## Verification

1. Seed one admin manually in Supabase; CSV-import a 300+300 fake roster; verify `roster_invites` rows and queued invite emails.
2. Log in as a mentor and a mentee via magic link; confirm `profiles` is auto-created with the right role.
3. RLS check: as a mentee, attempt to update another user's profile or `sessions_log` — must fail.
4. Post on bulletin board → admin hide → disappears for non-admins; unhide restores.
5. Log a session as admin; the count appears on both users' `/portal/me`.
6. `npm run lint` and `npm run build` pass on Vercel.

---

## Key decisions

- **Vercel** for hosting (GitHub Pages can't run server code or hold secrets).
- **Supabase** over a custom auth/DB stack to stay on a free tier and avoid running our own server.
- **Magic-link login** only — no passwords.
- **Admin import** is the only account-creation path; users cannot self-register.
- **Matching is out of scope** for Phase 1; will be designed later as an atomic server-enforced flow.
- **Multi-cohort from day one** via `cohort_id` so the system is reusable across programs.

---

## Open questions

1. Bilingual UI (EN/ZH) — keep portal copy in `src/data/portalCopy.ts` for Phase 1, defer i18n framework?
2. Is the directory visible to logged-out users? Recommended: **no**, login required.
3. Avatar upload size cap (suggest 1 MB) and accepted MIME types.
4. Bulletin board scope: single channel for the whole cohort, or split into mentor-only / mentee-only / mixed channels?
