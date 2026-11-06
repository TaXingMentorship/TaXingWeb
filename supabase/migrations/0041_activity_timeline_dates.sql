-- 负责人-editable dates for the 主线 / 支线 timeline on /portal/activities.
--
-- The timeline rows themselves still live in code (src/data/activityTimeline.ts),
-- each with a default `from` / `to` / `week`. A row here overrides those three
-- for one row (`row_key` = the row's `key`) in one season. A row with no
-- override shows the code's defaults; deleting the override restores them.
--
-- Like activity_items (0038) there is no check on `row_key`: a key that
-- disappears from the code simply stops applying.
--
-- Changing a row's dates does not move the 子活动 under it — they hang by
-- `parent_key`, not by date. The edit dialog warns when sessions would fall
-- outside the new range.
--
-- Everyone signed in reads. Only admins (负责人) write.

create table if not exists public.activity_timeline_dates (
  cohort_id   uuid not null references public.cohorts(id) on delete cascade,
  row_key     text not null check (length(btrim(row_key)) > 0),
  from_day    date not null,
  to_day      date not null,
  week_label  text not null check (length(btrim(week_label)) > 0),
  updated_by  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (cohort_id, row_key),
  constraint activity_timeline_dates_range check (from_day <= to_day)
);

drop trigger if exists trg_activity_timeline_dates_updated_at on public.activity_timeline_dates;
create trigger trg_activity_timeline_dates_updated_at
  before update on public.activity_timeline_dates
  for each row execute function public.set_updated_at();

alter table public.activity_timeline_dates enable row level security;

drop policy if exists activity_timeline_dates_select_auth on public.activity_timeline_dates;
create policy activity_timeline_dates_select_auth on public.activity_timeline_dates
  for select using (auth.uid() is not null);

drop policy if exists activity_timeline_dates_admin_all on public.activity_timeline_dates;
create policy activity_timeline_dates_admin_all on public.activity_timeline_dates
  for all
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.activity_timeline_dates to authenticated;
