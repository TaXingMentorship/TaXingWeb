# Mentorship Portal — Plan

A role-based mentorship portal ("她行 · Mentorship") on top of the existing TaXing Web site, with three identities: **admin**, **mentor**, **mentee**. Covers roster import, invite-only email/password login, profile setup, a mentor/mentee directory, multi-board bulletins, mentor↔mentee matching, activity resources, participation records, and progress tracking.

**Build strategy:** an **interactive hi-fi prototype first** (features on mock data with a fake account switcher, no auth, all copy in Simplified Chinese) so the team can click through and give feedback — **done**. **Phase B** now swaps the mock data-access seam for real Supabase auth + Postgres so we can do manual testing with real accounts.

**Prototype branch:** `agents/portal-prototype` (prototype, pushed, auto-deploys a Vercel preview).
**Current branch:** `agents/portal-production` (Phase B real-data wiring) — see below.

---

## Stack

| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js 15 + MUI v7 + React Query | Existing |
| Hosting | **Vercel** | Server routes, auth callbacks, secrets |
| Auth | Supabase Auth — invite-only email/password | No self-registration; email is used for invitations and recovery |
| Database | Supabase Postgres + Row Level Security | One service for auth + DB; free tier fits scale |
| Storage | Supabase Storage (buckets: `avatars`, `participation`) | Avatar images + participation screenshots |
| Email | Supabase default SMTP (Resend for bulk invite blast) | Avoids throttling on the one-time large send |

**Estimated cost at ~300 mentors + ~300 mentees: $0/month** (optional custom domain ~$10–15/yr).

---

## Data model (Postgres) — as built in `supabase/migrations/0001_init.sql`

Eight tables:

1. **`cohorts`** — one row per program run. `id, name, starts_at, ends_at, bulletin_open, created_at`.
2. **`profiles`** — one row per user. `id (FK auth.users), role ('admin'|'mentor'|'mentee'), cohort_ids (uuid[])`, plus:
   - Shared: `full_name` (昵称), `email`, `wechat_number`, `bio`, `background` (学术/行业经历), `field` (领域), `interests (text[])`, `linkedin`, `avatar_url`, `visible`.
   - Mentor-only: `years_experience`, `mentee_capacity`, `mentee_expectations`, `topics` (擅长与不擅长的话题).
   - Mentee-only: `help_needed` (问题/想获得的帮助).
   - Admin-editable: `admin_notes` (备注).
   - `created_at, updated_at`.
   - **Note:** `goals` (目标) was removed from the UI; drop the column from the migration if still present.
3. **`roster_invites`** — pending imports before first login. `id, cohort_id, email, full_name, role, invited_at, claimed_user_id`.
4. **`bulletin_boards`** — multiple boards per cohort (活动初期交友、毕业留言板🎓…). `id, cohort_id, title, description, created_by, created_at`.
5. **`bulletin_posts`** — `id, board_id, cohort_id, author_id, category, body, created_at, hidden`.
6. **`sessions_log`** — mentor/volunteer/admin-logged records. `id, cohort_id, mentor_id, mentee_id, session_type ('mentorship'|'gratitude'), session_date, notes, created_by, created_at`.
7. **`participation_records`** — mentee-submitted activity proof. `id, cohort_id, mentee_id, event_name, screenshot_url, created_at`.
8. **`matches`** — admin-uploaded mentor↔mentee pairing. `id, cohort_id, mentor_id, mentee_id, created_at`, `unique(cohort_id, mentor_id, mentee_id)`.

### RLS summary (in migration)
- `profiles`: shared-cohort users `SELECT` where `visible = true`; users `UPDATE` own row; admins anything.
- `bulletin_boards` / `bulletin_posts`: same-cohort `SELECT`; authenticated `INSERT` as self; author/admin `UPDATE`/`DELETE`; admins toggle `hidden`; board create gated to admin.
- `sessions_log`: read by involved mentor/mentee; write by admin **or** the mentor **only for a matched pair** (`matches` existence check enforced in the policy).
- `participation_records`: mentee reads/writes own; admin all.
- `matches`: involved users `SELECT`; admin-only write.
- `roster_invites`: admin only.

---

## Routes & UI surface

Nav order: **首页 · 我的资料 · 本期活动 · 成员目录 · 进度跟踪 · 留言板 · 成员名单(admin) · 名单导入(admin)**.

| Route | Purpose | Status |
|---|---|---|
| `/portal` | Role-aware landing tiles | ✅ prototype |
| `/portal/me` | Edit own profile (昵称, 领域, 经历, role fields, 公开开关) | ✅ |
| `/portal/activities` | 本期活动: 重要文件 / 主线活动 / 支线活动 (links TBD) | ✅ (placeholder) |
| `/portal/directory` | 成员目录: 导师/学员 tabs, search + interest filter, detail dialog | ✅ |
| `/portal/board` | 留言板: Padlet 式单页 — 顶部 tab 切换留言板、彩色卡片瀑布流、标题/匿名/配色/emoji 投稿、表情反应、评论；admin 可新建留言板并置顶/标记已解答/隐藏 | ✅ |
| `/portal/board/[boardId]` | 重定向到 `/portal/board?board=<id>`（保留旧链接） | ✅ |
| `/portal/admin/sessions` | 进度跟踪: mentor/mentee views, log 交流记录 (type), participation submit, matched-pair gating | ✅ |
| `/portal/admin/roster` | 成员名单: read-only auto-pulled sheet + 配对关系 nested view; only 备注 editable | ✅ |
| `/portal/admin/import` | 名单导入: roster CSV + match CSV upload | ✅ |
| `/portal/login` | Magic-link email form | ⏳ Phase B |
| `/portal/onboarding` | First-login profile setup, prefilled from `roster_invites` | ⏳ Phase B |

Server-only Route Handlers under `src/app/api/admin/*` for service-role actions (roster import, match import, session logging, moderation). Other reads/writes use the browser Supabase client gated by RLS.

---

## Status

### Phase 0 — Vercel hosting ✅ *(site live on Vercel)*

### Phase A — Backend foundation ✅ *(code complete; live Supabase deferred to Phase B)*
- ✅ `supabase/migrations/0001_init.sql` — 8 tables, enums, indexes, `is_admin()`/`current_cohort_ids()` helpers, RLS, `updated_at` trigger.
- ✅ Installed `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `papaparse`.
- ✅ `src/lib/supabase/{client,server}.ts`, `src/lib/auth.ts` (`getCurrentUser`, `requireRole`), `src/types/portal.ts`, `.env.example`.

### Phase P — Interactive hi-fi prototype ✅ *(branch `agents/portal-prototype`, mock data, no auth, Simplified Chinese)*
- ✅ Mock data + `localStorage` data-access seam (`src/lib/portal/{mockData,store.ts}`), versioned/reseedable (`DB_VERSION = 6`). Store exposes async, Supabase-shaped CRUD for all 8 tables (profiles, boards, posts, sessions, participation, roster import, matches, cohorts).
- ✅ Fake account switcher + `PortalShell` (role-gated nav), AppBar 师友门户 → Log In entry.
- ✅ Feature D (profiles & directory), E (multi-board bulletins), C (roster import), F (progress tracker + participation), matching (import + nested roster view + matched-pair gating on session logging), 本期活动 tab.
- ✅ `npm run lint` + `npm run build` pass; all `/portal/*` routes return 200; branch pushed; Vercel preview shared.

---

## Phase B — Real auth & data wiring  ← WE ARE HERE

Goal: connect the existing UI to a real Supabase project so we can do manual testing with real accounts. The UI is built against the `store.ts` seam, so this is mostly (1) external Supabase setup by the user and (2) swapping the seam internals + adding auth on the app side.

### Are we ready?
**Yes on the app side** — the prototype is feature-complete and feedback is incorporated. The only blockers are external Supabase setup steps that only the account owner (you) can do. Recommended: create a **new branch `agents/portal-production`** off `agents/portal-prototype` so the clickable prototype stays intact while we wire real data.

### B0 — Branch
- [x] Created `agents/portal-production` from the pushed `agents/portal-prototype` branch.

### B1 — External setup *(you; app can't do these)*
- [x] Create a Supabase project; copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Put them in `.env.local` (done, gitignored) and in Vercel project env vars (Production + Preview).
- [x] Apply `supabase/migrations/0001_init.sql`, `0002_onboarding_uploads.sql`, and `0003_admin_operations.sql`.
- [x] Create Storage buckets: `avatars` (public, 2 MB) and `participation` (private, 5 MB).
- [x] Auth settings: enable magic-link (email OTP); set Site URL + local/production callback redirect URLs.
- [x] Seed the `2026 Autumn` cohort and one admin profile.

### B2 — App-side wiring *(me)*
- [x] `middleware.ts` using `@supabase/ssr` to refresh the session cookie and protect `/portal/*` (redirect unauthenticated → `/portal/login`).
- [x] `/portal/login` password form, invitation/password-recovery callback, and password setup/update pages.
- [x] Real Supabase session/profile context preserving `usePortalSession()`; demo switcher removed.
- [x] Real Supabase-backed `store.ts` with existing UI-facing function signatures.
- [x] Secure invite-based `/portal/onboarding`.
- [x] Avatar and private participation screenshot uploads.
- [x] Zod-validated admin import, matching, session, and moderation handlers.
- [x] Real avatar/role display and sign-out in the portal shell.

### B3 — Verify (manual testing)
- [ ] Seed admin; CSV-import a small roster; confirm `roster_invites` rows.
- [ ] Log in via magic link as a mentor and a mentee; confirm `profiles` auto-created with the right role via onboarding.
- [ ] Upload a match CSV; confirm 成员名单 配对关系 nesting and that a mentor can log 交流记录 only for matched mentees; unmatched mentor is blocked; admin unrestricted.
- [ ] Mentee submits a participation record with a screenshot; admin sees it in 成员名单.
- [ ] RLS negative checks: as a mentee, attempt to update another user's profile or `sessions_log` — must fail.
- [ ] `npm run lint` + `npm run build` pass; deploy preview and smoke-test.

### Phase H — Volunteer roster

- [x] `volunteers` / `volunteer_groups` / `volunteer_seasons` + RLS + the
      `volunteers_public` view (migration `0010`); 94 legacy volunteers and
      eight historical seasons backfilled (`0011`).
- [x] `/portal/volunteers` — group tabs, season filter, search, admin add/edit/
      delete. Default tab is the viewer's own group; admins land on 全部.
- [x] `/portal/admin/volunteers` — Excel/CSV import with dry-run preview, and
      group management.
- [x] `/about` reads `volunteers_public`; `src/data/volunteers.ts` deleted.
- [ ] Apply `0010` and `0011` in the Supabase SQL editor, then run through the
      manual checks in the volunteer section of `STRUCTURE.md`.
- [ ] Backfill group membership for the historical seasons — the legacy data
      records who and when, but not which group.

### Phase I — Persona switching & identity linking

- [x] Persona switcher (`0012` not required): `PortalSessionProvider` projects
      `currentUser` through the active persona, so the sidebar, the home tiles
      and every page's own `is_admin` check follow with no page changes.
      Display-only — `PersonaBanner` says so while a preview is active.
- [x] `volunteers.profile_id` linked automatically by email, with triggers on
      both tables; name matches surface for admin confirmation (`0012`).
- [x] `volunteers_resolved` — the linked profile wins for name, contact and
      avatar; no two-way sync.
- [x] Season matching ignores internal whitespace, so `2025 春季` and `2025春季`
      find the same cohort.
- [x] Fixed 成员目录's 志愿者 tab, which listed admins (`is_admin || is_volunteer`)
      and no actual volunteers.
- [x] Volunteer roster shows one chip per season carrying that season's group,
      so a change of group across seasons is legible.
- [x] Group leads (`0013`): `is_lead` per season, `includes_leads` per group, so
      战略组 contains the leads without a second membership row.
- [x] Identity tags editable inline on 成员名单 (`/api/admin/profiles`, with a
      last-admin guard).
- [x] Season rows in the volunteer dialog sort newest-first.
- [x] Dropped the persona preview banner at the user's request — the sidebar
      switcher remains the indication.
- [ ] **No Google Sheet sync exists.** 2025春季 / 2026春季 / 2026秋季 have no
      volunteers because the retired `volunteers.ts` only went up to 2025夏季.
      Export the sheet to .xlsx and import it.
- [ ] Confirm the four name-match candidates (renee / simona / 核糖 / 蛋子) in
      `/portal/admin/volunteers`.
- [ ] `2025夏季` ends `2026-09-07`, a year after it starts — looks like a typo;
      fix in 季度管理.

### Phase G — Hardening *(after B verified)*
- [x] **True anonymous posting.** Done in `0009`: reads go through
      `bulletin_posts_readable` / `bulletin_comments_readable`, which null out
      `author_id` unless you are the author or an admin; the base tables grant
      INSERT only, so update and delete moved to `/api/admin/moderation`.
- [ ] Rate-limit bulletin posts (per user per minute).
- [x] Import dry-run mode. Done for the volunteer import (`admin_import_volunteers(p_rows, p_dry_run)`); the roster/match imports still write straight away.
- [ ] Finalize "全部完成本期活动" requirements definition (currently a placeholder heuristic in the roster view).
- [ ] Wire real 本期活动 resource links once provided.

---

## Key decisions

- **Prototype-first**, then swap the data-access seam for Supabase — low-risk because the UI only depends on `store.ts` signatures and `usePortalSession()`.
- **Vercel** for hosting (server code + secrets); **Supabase** for auth + DB on the free tier.
- **Invite-only email/password login**, with email reserved for invitations and password recovery. **Admin import is the only account-creation path** — no self-registration.
- **Multi-cohort from day one** via `cohort_ids` (a user can be in several program runs).
- **Matching** is admin-uploaded by ID; session logging by mentors is gated to matched pairs (admins unrestricted).
- **Roster is read-only** on the site (auto-pulled from records); only `admin_notes` (备注) is editable — avoids concurrent-edit conflicts.
- All portal copy is **Simplified Chinese**; brand is **她行 · Mentorship**.

## Open questions
1. Directory visible to logged-out users? Recommended: **no**, login required.
2. Avatar / screenshot size caps and accepted MIME types.
3. Exact definition of "全部完成本期活动" (which requirements count).
4. 本期活动 resource links (重要文件 / 主线活动 / 支线活动) — pending from you.
