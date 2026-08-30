# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `STRUCTURE.md` before changing anything under `src/lib/portal/`, `src/app/portal/`, `src/app/api/`, or `supabase/migrations/`.** It documents the data flow, auth, identity model, seasons and bulletin board in full. `PLAN.md` tracks feature status and open work.

Stack: Next.js 15 App Router · React 19 · TypeScript · MUI v7 · React Query · Supabase. `@/*` → `src/*`.

## Verification

```bash
npm run lint && npm run build
```

There is no test framework — these two are the gate. Use `npx tsc --noEmit` for a type check that leaves `.next` alone.

**Stop the dev server before running `npm run build`.** Both write to `.next`; the build clobbers the dev server's chunks, which then dies with `Cannot find module './NNNN.js'` and 404s every asset. Recover with `rm -rf .next` and restart.

## Rules that are easy to break

- **Three Supabase clients**, and picking the wrong one is the usual mistake: browser (`lib/supabase/client.ts`, RLS), request-scoped server (`lib/supabase/server.ts` → `createClient`, RLS), and `createServiceRoleClient()` which **bypasses RLS** and belongs only in `src/app/api/admin/**`.
- **All portal queries go through `src/lib/portal/store.ts`.** Do not call Supabase from a page. Privileged writes POST to `src/app/api/admin/*` instead of using the browser client.
- **Bulletin anonymity is enforced in the database** (migration `0009`). Clients read `bulletin_posts_readable` / `bulletin_comments_readable`, which mask `author_id`; the base tables grant INSERT only. So `author_id` is `string | null`, inserts cannot `.select()` the row back, and the views are SECURITY DEFINER — their `WHERE` clause is the row boundary.
- **No client-side UPDATE or DELETE on `bulletin_posts` / `bulletin_comments`** (migrations `0007`, `0009`). Extend `/api/admin/moderation` instead.
- **Copy lives in `src/data/`** — `portalCopy.ts` for the portal, the other data files for the marketing site. Do not hardcode strings in components.
- **`src/types/portal.ts` changes in step with a migration.** Migrations are applied by hand in the Supabase SQL editor, in filename order, one commit at a time.
- **Responsive layout uses CSS breakpoints, not `useMediaQuery`**, and `AppRouterCacheProvider` in `src/app/layout.tsx` must stay — removing either breaks hydration on every page.
- **Portal navigation is defined once** in `src/data/portalNav.ts`, shared by the sidebar and the home tiles.
