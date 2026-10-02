-- Authors can edit their own posts and comments while the board is open.
--
-- Editing has no client-side path: 0007 / 0009 withdrew UPDATE from
-- `authenticated`, and that stays. The edit is a PATCH to
-- /api/admin/moderation with `action: "edit"`, which checks in code that the
-- caller is the author (admins get no exception) and that the board and season
-- are still open (the same rule 0020 enforces for inserts), then writes with
-- the service-role client.
--
-- The only schema change is `edited_at`, so readers can show 「已编辑」. It is
-- null until the first real change. Both readable views gain the column at the
-- end — `create or replace` keeps their grants and the 0009 row boundary
-- (the WHERE clause) exactly as it was.

alter table public.bulletin_posts
  add column if not exists edited_at timestamptz;
alter table public.bulletin_comments
  add column if not exists edited_at timestamptz;

create or replace view public.bulletin_posts_readable
with (security_invoker = false) as
select
  p.id, p.cohort_id, p.board_id,
  case
    when p.is_anonymous and not public.is_admin() and p.author_id is distinct from auth.uid()
    then null else p.author_id
  end as author_id,
  p.category, p.title, p.body, p.is_anonymous, p.color, p.pinned, p.resolved,
  p.image_paths, p.hidden, p.created_at, p.edited_at
from public.bulletin_posts p
where p.hidden = false or p.author_id = auth.uid() or public.is_admin();

create or replace view public.bulletin_comments_readable
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
  c.created_at,
  c.edited_at
from public.bulletin_comments c
where c.hidden = false
   or c.author_id = auth.uid()
   or public.is_admin();
