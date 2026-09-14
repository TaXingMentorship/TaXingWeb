-- True anonymous posting.
--
-- Until now `is_anonymous` only hid the author's name in the UI: `author_id`
-- was still sent to every reader, and the app also hands each member the
-- id→name map for their own cohort (`listProfiles`), so recovering the author
-- of a same-cohort anonymous post was a one-step lookup in dev tools.
--
-- Reads now go through views that mask `author_id`, and the base tables are no
-- longer readable by clients at all:
--
--   * admins            → real author_id (moderation must stay possible)
--   * the author        → real author_id (their own row)
--   * everyone else     → null, for anonymous rows only
--
-- These views are SECURITY DEFINER (the default), so they run as the owner and
-- bypass RLS on the base table. Their WHERE clause is therefore the entire row
-- boundary and must mirror the `*_select_all` policies from 0008.
--
-- Writes are unaffected: INSERT still goes to the base table under the existing
-- policies, and UPDATE/DELETE go through /api/admin/moderation with the
-- service-role client (see 0007).

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------
drop view if exists public.bulletin_posts_readable;
create view public.bulletin_posts_readable
with (security_invoker = false) as
select
  p.id,
  p.cohort_id,
  p.board_id,
  case
    when p.is_anonymous
     and not public.is_admin()
     and p.author_id is distinct from auth.uid()
    then null
    else p.author_id
  end as author_id,
  p.category,
  p.title,
  p.body,
  p.is_anonymous,
  p.color,
  p.pinned,
  p.resolved,
  p.hidden,
  p.created_at
from public.bulletin_posts p
where p.hidden = false
   or p.author_id = auth.uid()
   or public.is_admin();

drop view if exists public.bulletin_comments_readable;
create view public.bulletin_comments_readable
with (security_invoker = false) as
select
  c.id,
  c.post_id,
  c.cohort_id,
  case
    when c.is_anonymous
     and not public.is_admin()
     and c.author_id is distinct from auth.uid()
    then null
    else c.author_id
  end as author_id,
  c.body,
  c.is_anonymous,
  c.hidden,
  c.created_at
from public.bulletin_comments c
where c.hidden = false
   or c.author_id = auth.uid()
   or public.is_admin();

-- ---------------------------------------------------------------------------
-- Privileges: clients read the views, never the base tables
-- ---------------------------------------------------------------------------
revoke all on public.bulletin_posts_readable from anon, authenticated;
revoke all on public.bulletin_comments_readable from anon, authenticated;
grant select on public.bulletin_posts_readable to authenticated;
grant select on public.bulletin_comments_readable to authenticated;

-- Signed-in members keep INSERT so they can still post; select/update/delete
-- are withdrawn, which is what removes the author_id leak.
--
-- `anon` (not signed in) loses INSERT too. RLS already blocked it — the insert
-- policy requires author_id = auth.uid(), which is null for anon — but the
-- grant had no business being there, and relying on RLS alone leaves one layer
-- instead of two. It comes from Supabase's default table privileges.
revoke select, insert, update, delete on public.bulletin_posts from anon;
revoke select, insert, update, delete on public.bulletin_comments from anon;
revoke select, update, delete on public.bulletin_posts from authenticated;
revoke select, update, delete on public.bulletin_comments from authenticated;
grant insert on public.bulletin_posts to authenticated;
grant insert on public.bulletin_comments to authenticated;
