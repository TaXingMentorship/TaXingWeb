-- 子活动: entries nested under the 主线 / 支线 timeline rows on /portal/activities.
--
-- The timeline itself is still hardcoded in the page; each row there has a
-- `key` (e.g. `qa_group`, `roundtable_w4`), and a row here hangs under the row
-- with the same `parent_key` in the same season. There is deliberately no
-- check on `parent_key`: the timeline lives in code, so a row whose key
-- disappears simply stops showing.
--
-- Two shapes share one table, decided by `kind`:
--   - `link`: title + url, e.g. the 答疑组 Tencent sheet;
--   - `session`: starts_at + title (主题), with an optional summary, meeting
--     link and recording link. The recording is usually added afterwards.
--
-- Everyone signed in reads every season, like boards (0008). Admins and the
-- season's volunteers (`is_season_volunteer`, 0032) write — the same rule as
-- board notices, since volunteers are the ones running these sessions.
-- Links must be http(s): they are rendered as hrefs.

-- An earlier draft of this migration created `activity_items` with a
-- `category` column instead of `parent_key` / `kind`. `create table if not
-- exists` would silently keep that shape, so refuse instead: drop the old
-- table by hand (it was only ever test data) and run this again.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'activity_items'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'activity_items'
      and column_name = 'parent_key'
  ) then
    raise exception 'activity_items has the old draft shape (no parent_key). Run "drop table public.activity_items;" and then this migration again.';
  end if;
end
$$;

create table if not exists public.activity_items (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.cohorts(id) on delete cascade,
  parent_key    text not null check (length(btrim(parent_key)) > 0),
  kind          text not null check (kind in ('link', 'session')),
  title         text not null check (length(btrim(title)) > 0),
  starts_at     timestamptz,
  summary       text,
  url           text check (url ~* '^https?://'),
  meeting_url   text check (meeting_url ~* '^https?://'),
  recording_url text check (recording_url ~* '^https?://'),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint activity_items_shape check (
    case kind
      when 'link' then url is not null
      else starts_at is not null
    end
  )
);

create index if not exists activity_items_cohort_idx
  on public.activity_items (cohort_id);

drop trigger if exists trg_activity_items_updated_at on public.activity_items;
create trigger trg_activity_items_updated_at
  before update on public.activity_items
  for each row execute function public.set_updated_at();

alter table public.activity_items enable row level security;

drop policy if exists activity_items_select_auth on public.activity_items;
create policy activity_items_select_auth on public.activity_items
  for select using (auth.uid() is not null);

drop policy if exists activity_items_staff_all on public.activity_items;
create policy activity_items_staff_all on public.activity_items
  for all
  using (public.is_admin() or public.is_season_volunteer(cohort_id))
  with check (public.is_admin() or public.is_season_volunteer(cohort_id));

grant select, insert, update, delete on public.activity_items to authenticated;
