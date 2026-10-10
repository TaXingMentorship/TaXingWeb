-- 「你的提问有新评论」提醒.
--
-- A reader marks a post as seen when they open its comments
-- (`bulletin_post_reads`). `my_unread_comment_summary()` then answers, for the
-- signed-in user, which of THEIR posts have comments by someone else that are
-- newer than that marker — or newer than the post itself when it was never
-- opened.
--
-- The function is SECURITY DEFINER because 0009 revoked SELECT on the base
-- tables from clients, and it keys everything on auth.uid(). It returns no
-- commenter identity, so it cannot be used to unmask an anonymous comment.
-- Hidden posts and hidden comments never count.
--
-- Comments the user wrote themselves never count. Anonymous comments by others
-- do: `author_id is distinct from auth.uid()` is true for them.

create table if not exists public.bulletin_post_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.bulletin_posts (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.bulletin_post_reads enable row level security;

drop policy if exists bulletin_post_reads_select_own on public.bulletin_post_reads;
create policy bulletin_post_reads_select_own on public.bulletin_post_reads
  for select using (user_id = auth.uid());

drop policy if exists bulletin_post_reads_insert_own on public.bulletin_post_reads;
create policy bulletin_post_reads_insert_own on public.bulletin_post_reads
  for insert with check (user_id = auth.uid());

drop policy if exists bulletin_post_reads_update_own on public.bulletin_post_reads;
create policy bulletin_post_reads_update_own on public.bulletin_post_reads
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.my_unread_comment_summary()
returns table (
  post_id         uuid,
  board_id        uuid,
  cohort_id       uuid,
  group_id        uuid,
  title           text,
  body            text,
  unread_count    int,
  last_comment_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.board_id, p.cohort_id, p.group_id, p.title, p.body,
    count(c.id)::int,
    max(c.created_at)
  from public.bulletin_posts p
  join public.bulletin_comments c
    on c.post_id = p.id
   and c.hidden = false
   and c.author_id is distinct from auth.uid()
  left join public.bulletin_post_reads r
    on r.post_id = p.id and r.user_id = auth.uid()
  where p.author_id = auth.uid()
    and p.hidden = false
    and c.created_at > coalesce(r.seen_at, p.created_at)
  group by p.id
  order by max(c.created_at) desc;
$$;

revoke all on function public.my_unread_comment_summary() from public;
grant execute on function public.my_unread_comment_summary() to authenticated;
