-- Mentor Q&A groups.
--
-- A season has a set of answer groups (产品经理 组2, 运营 组1 …). Each mentor
-- belongs to exactly one group per season but may answer in any of them.
-- Mentees post to a group on a board that has `use_groups` switched on.
--
--   * mentor_groups          — the groups of a season, with a 方向 label
--   * mentor_group_members   — which mentor sits in which group (one per season)
--   * bulletin_boards.use_groups, bulletin_posts.group_id
--   * board_notices          — 留言须知 (per group) and 提醒 (whole board)
--
-- Group and membership tables are readable by any signed-in member (they hold
-- no private data and a past season's board is readable by everyone, 0008) and
-- writable by admins only, the same shape as `bulletin_boards`. Notices are
-- writable by admins and volunteers.
--
-- Mentors may not comment anonymously on a grouped board — that is what lets
-- the UI trust a "Mentor" badge. A trigger enforces it, because the insert
-- policy cannot read bulletin_posts (0009 revoked SELECT from clients).

-- ---------------------------------------------------------------------------
-- Groups and membership
-- ---------------------------------------------------------------------------
create table if not exists public.mentor_groups (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  direction  text check (direction is null or char_length(direction) <= 40),
  name       text not null check (char_length(name) between 1 and 60),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (cohort_id, name)
);

create index if not exists idx_mentor_groups_cohort
  on public.mentor_groups (cohort_id, sort_order, name);

create table if not exists public.mentor_group_members (
  id         uuid primary key default gen_random_uuid(),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  group_id   uuid not null references public.mentor_groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One group per mentor per season.
  unique (cohort_id, profile_id)
);

create index if not exists idx_mentor_group_members_group
  on public.mentor_group_members (group_id);

alter table public.mentor_groups        enable row level security;
alter table public.mentor_group_members enable row level security;

drop policy if exists mentor_groups_select_auth on public.mentor_groups;
create policy mentor_groups_select_auth on public.mentor_groups
  for select using (auth.uid() is not null);

drop policy if exists mentor_groups_admin_all on public.mentor_groups;
create policy mentor_groups_admin_all on public.mentor_groups
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists mentor_group_members_select_auth on public.mentor_group_members;
create policy mentor_group_members_select_auth on public.mentor_group_members
  for select using (auth.uid() is not null);

drop policy if exists mentor_group_members_admin_all on public.mentor_group_members;
create policy mentor_group_members_admin_all on public.mentor_group_members
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Boards and posts
-- ---------------------------------------------------------------------------
alter table public.bulletin_boards
  add column if not exists use_groups boolean not null default false;

-- A group that is deleted leaves its posts in place, ungrouped.
alter table public.bulletin_posts
  add column if not exists group_id uuid references public.mentor_groups (id) on delete set null;

create index if not exists idx_bulletin_posts_group
  on public.bulletin_posts (board_id, group_id, created_at desc);

-- Same definition as 0023 with `group_id` appended; the WHERE clause is the row
-- boundary and is unchanged.
create or replace view public.bulletin_posts_readable
with (security_invoker = false) as
select
  p.id, p.cohort_id, p.board_id,
  case
    when p.is_anonymous and not public.is_admin() and p.author_id is distinct from auth.uid()
    then null else p.author_id
  end as author_id,
  p.category, p.title, p.body, p.is_anonymous, p.color, p.pinned, p.resolved,
  p.image_paths, p.hidden, p.created_at, p.edited_at, p.group_id
from public.bulletin_posts p
where p.hidden = false or p.author_id = auth.uid() or public.is_admin();

-- ---------------------------------------------------------------------------
-- Mentors cannot comment anonymously on a grouped board
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
    raise exception 'Mentors cannot comment anonymously on a Q&A board';
  end if;
  return new;
end;
$$;

drop trigger if exists bulletin_comment_mentor_not_anonymous on public.bulletin_comments;
create trigger bulletin_comment_mentor_not_anonymous
  before insert on public.bulletin_comments
  for each row execute function public.bulletin_comment_mentor_not_anonymous();

-- ---------------------------------------------------------------------------
-- Notices: per-group 留言须知 and board-wide 志愿者提醒
-- ---------------------------------------------------------------------------
create table if not exists public.board_notices (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.bulletin_boards (id) on delete cascade,
  -- null = the whole board (a reminder); set = one group's 留言须知.
  group_id   uuid references public.mentor_groups (id) on delete cascade,
  kind       text not null check (kind in ('guide', 'reminder')),
  body       text not null check (char_length(body) between 1 and 2000),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists idx_board_notices_board
  on public.board_notices (board_id, kind, created_at desc);

alter table public.board_notices enable row level security;

drop policy if exists board_notices_select_auth on public.board_notices;
create policy board_notices_select_auth on public.board_notices
  for select using (auth.uid() is not null);

drop policy if exists board_notices_staff_all on public.board_notices;
create policy board_notices_staff_all on public.board_notices
  for all
  using (public.is_admin() or public.is_volunteer())
  with check (public.is_admin() or public.is_volunteer());
