-- Fixes to the Q&A board (0028–0030), found in review.
--
--   1. bulletin_post_reads.seen_at is clamped to the server clock and never
--      moves backwards. The client sends the newest comment it actually loaded
--      (a server timestamp), so a comment it never saw is never marked read and
--      a wrong device clock cannot hide or resurrect a reminder.
--   2. A post on a Q&A board must name a group of that board's season; a post on
--      any other board must not name one. The UI already asks for it; a request
--      that skips the UI could leave a post no group wall shows.
--   3. A mentor's seat names a group of the same season, and only mentors sit.
--   4. The mentor-anonymous trigger raises a message the UI can show as is.
--   5. Volunteers edit notices only on boards of their own seasons.
--   6. Index for the `mine` scan in my_unread_comment_summary() (0030).

-- ---------------------------------------------------------------------------
-- 1. Read markers follow the server clock
-- ---------------------------------------------------------------------------
create or replace function public.bulletin_post_reads_clamp()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.seen_at := least(coalesce(new.seen_at, now()), now());
  if tg_op = 'UPDATE' then
    new.seen_at := greatest(old.seen_at, new.seen_at);
  end if;
  return new;
end;
$$;

drop trigger if exists bulletin_post_reads_clamp on public.bulletin_post_reads;
create trigger bulletin_post_reads_clamp
  before insert or update on public.bulletin_post_reads
  for each row execute function public.bulletin_post_reads_clamp();

-- ---------------------------------------------------------------------------
-- 2. Posts on a Q&A board belong to one of its season's groups
-- ---------------------------------------------------------------------------
create or replace function public.bulletin_post_group_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  board public.bulletin_boards;
begin
  select * into board from public.bulletin_boards where id = new.board_id;
  if not found then
    return new;
  end if;

  if board.use_groups then
    if new.group_id is null then
      raise exception '答疑板的提问必须选择一个答疑组';
    end if;
    if not exists (
      select 1 from public.mentor_groups g
      where g.id = new.group_id and g.cohort_id = board.cohort_id
    ) then
      raise exception '所选答疑组不属于这个留言板的季度';
    end if;
  elsif new.group_id is not null then
    raise exception '只有答疑板的帖子可以选择答疑组';
  end if;
  return new;
end;
$$;

-- Insert only: deleting a group sets group_id to null (0028), and an admin may
-- switch use_groups on an existing board; neither should be blocked.
drop trigger if exists bulletin_post_group_check on public.bulletin_posts;
create trigger bulletin_post_group_check
  before insert on public.bulletin_posts
  for each row execute function public.bulletin_post_group_check();

-- ---------------------------------------------------------------------------
-- 3. Seats: same season as the group, mentors only
-- ---------------------------------------------------------------------------
alter table public.mentor_groups
  drop constraint if exists mentor_groups_id_cohort_key;
alter table public.mentor_groups
  add constraint mentor_groups_id_cohort_key unique (id, cohort_id);

alter table public.mentor_group_members
  drop constraint if exists mentor_group_members_group_id_fkey;
alter table public.mentor_group_members
  drop constraint if exists mentor_group_members_group_cohort_fkey;
alter table public.mentor_group_members
  add constraint mentor_group_members_group_cohort_fkey
  foreign key (group_id, cohort_id)
  references public.mentor_groups (id, cohort_id)
  on delete cascade;

create or replace function public.mentor_group_members_mentor_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles pr
    where pr.id = new.profile_id and pr.participant_role = 'mentor'
  ) then
    raise exception '只有 mentor 可以分配到答疑组';
  end if;
  return new;
end;
$$;

drop trigger if exists mentor_group_members_mentor_only on public.mentor_group_members;
create trigger mentor_group_members_mentor_only
  before insert or update on public.mentor_group_members
  for each row execute function public.mentor_group_members_mentor_only();

-- ---------------------------------------------------------------------------
-- 4. Same rule as 0028, with a message the UI can show
-- ---------------------------------------------------------------------------
create or replace function public.bulletin_comment_mentor_not_anonymous()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_anonymous
     and exists (
       select 1 from public.profiles pr
       where pr.id = new.author_id and pr.participant_role = 'mentor'
     )
     and exists (
       select 1
       from public.bulletin_posts p
       join public.bulletin_boards b on b.id = p.board_id
       where p.id = new.post_id and b.use_groups
     )
  then
    raise exception 'Mentor 在答疑板的评论需要实名';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Volunteers: notices on their own seasons' boards only
-- ---------------------------------------------------------------------------
drop policy if exists board_notices_staff_all on public.board_notices;
create policy board_notices_staff_all on public.board_notices
  for all
  using (
    public.is_admin()
    or (
      public.is_volunteer()
      and exists (
        select 1 from public.bulletin_boards b
        where b.id = board_id and b.cohort_id = any(public.current_cohort_ids())
      )
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_volunteer()
      and exists (
        select 1 from public.bulletin_boards b
        where b.id = board_id and b.cohort_id = any(public.current_cohort_ids())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Index for my_unread_comment_summary()
-- ---------------------------------------------------------------------------
create index if not exists idx_bulletin_comments_author_post
  on public.bulletin_comments (author_id, post_id, created_at);
