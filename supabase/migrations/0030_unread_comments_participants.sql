-- 新评论提醒 now also reaches people who COMMENTED on a post, not just its author.
--
-- 0029 only counted comments on the viewer's own posts. In a Q&A thread that
-- misses the common case: a mentor answers, the mentee follows up, and the
-- mentor is never told. A post is now "followed" when the viewer wrote it or has
-- a comment on it.
--
-- What counts as new, per followed post:
--   * the baseline is the later of
--       - when the viewer last opened it (bulletin_post_reads), or, if never,
--         the post's creation for its author / the viewer's first comment for
--         everyone else — so joining a long thread does not flag its history;
--       - the viewer's own latest comment (writing a reply means having read
--         the thread up to then);
--   * only comments by someone else, after that baseline, and not hidden.
--
-- Still SECURITY DEFINER and keyed on auth.uid(); still returns no commenter
-- identity, so it cannot unmask an anonymous comment. The return type is
-- unchanged.

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
  with mine as (
    select c.post_id,
           min(c.created_at) as first_at,
           max(c.created_at) as last_at
    from public.bulletin_comments c
    where c.author_id = auth.uid()
    group by c.post_id
  )
  select
    p.id, p.board_id, p.cohort_id, p.group_id, p.title, p.body,
    count(o.id)::int,
    max(o.created_at)
  from public.bulletin_posts p
  left join mine m on m.post_id = p.id
  left join public.bulletin_post_reads r
    on r.post_id = p.id and r.user_id = auth.uid()
  join public.bulletin_comments o
    on o.post_id = p.id
   and o.hidden = false
   and o.author_id is distinct from auth.uid()
  where p.hidden = false
    and (p.author_id = auth.uid() or m.post_id is not null)
    and o.created_at > greatest(
      coalesce(
        r.seen_at,
        case when p.author_id = auth.uid() then p.created_at else m.first_at end
      ),
      coalesce(m.last_at, '-infinity'::timestamptz)
    )
  group by p.id
  order by max(o.created_at) desc;
$$;

revoke all on function public.my_unread_comment_summary() from public;
grant execute on function public.my_unread_comment_summary() to authenticated;
