-- Volunteer roster.
--
-- Until now the volunteer list was a hardcoded array in `src/data/volunteers.ts`
-- (94 rows of `{ name, participation }`) rendered only on the public /about
-- page. Adding a volunteer meant a code change and a redeploy, and there was no
-- group, no contact detail and no permission model.
--
-- This is a separate concern from `profiles`: a volunteer is a person who
-- helped run a season, and almost none of them have a portal account. The
-- optional `volunteers.profile_id` links the two when they do.
--
-- Seasons reuse `cohorts` — the organising axis of the whole portal — rather
-- than introducing a parallel season table. Group membership hangs off
-- `volunteer_seasons`, not off the volunteer, so moving between groups between
-- seasons is recorded rather than overwritten.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.volunteer_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- `name_key` and `email_key` are the deduplication keys for the Excel import.
-- Email is optional (the 94 legacy rows have none), so the name is the fallback
-- key and carries a hard unique index of its own: it is what makes "no
-- duplicate records" enforceable rather than merely intended. Two genuinely
-- different people with the same name have to be distinguished by a suffix —
-- which is already the convention in the legacy data ("Julie Spring" vs
-- "julie", "rita-Weil Cornell").
create table if not exists public.volunteers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  name_key      text generated always as (lower(btrim(full_name))) stored,
  email         text,
  email_key     text generated always as (nullif(lower(btrim(email)), '')) stored,
  wechat_number text,
  notes         text,
  -- Whether this volunteer appears in the public /about acknowledgement list.
  is_public     boolean not null default true,
  profile_id    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint volunteers_full_name_not_blank check (btrim(full_name) <> '')
);

create unique index if not exists idx_volunteers_email_key
  on public.volunteers (email_key)
  where email_key is not null;

create unique index if not exists idx_volunteers_name_key
  on public.volunteers (name_key);

create index if not exists idx_volunteers_profile
  on public.volunteers (profile_id)
  where profile_id is not null;

create table if not exists public.volunteer_seasons (
  id           uuid primary key default gen_random_uuid(),
  volunteer_id uuid not null references public.volunteers (id)       on delete cascade,
  cohort_id    uuid not null references public.cohorts (id)          on delete cascade,
  group_id     uuid          references public.volunteer_groups (id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (volunteer_id, cohort_id)
);

create index if not exists idx_volunteer_seasons_cohort on public.volunteer_seasons (cohort_id);
create index if not exists idx_volunteer_seasons_group  on public.volunteer_seasons (group_id);

drop trigger if exists trg_volunteers_updated_at on public.volunteers;
create trigger trg_volunteers_updated_at
  before update on public.volunteers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Seed groups
--
-- Copy taken from the four cards already on the home page
-- (src/components/sections/VolunteersSection.tsx). Adding a fifth group is an
-- INSERT here or a click in /portal/admin/volunteers — never a code change.
-- ---------------------------------------------------------------------------
insert into public.volunteer_groups (name, description, sort_order) values
  ('战略组', '负责她行的策划与管理工作', 10),
  ('人事组', '负责与活动参与者 Mentor 和 Mentee 们进行对接', 20),
  ('运营组', '负责她行的对外宣传工作', 30),
  ('项目组', '负责策划与组织她行中的圆桌讨论及分享交流活动，促进成员间的经验分享与深入交流', 40)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Every signed-in member sees the whole roster, contact details included — the
-- groups are views over one list, not walled gardens. Writes are admin-only and
-- in practice go through /api/admin/volunteers with the service-role client,
-- mirroring roster_invites.
-- ---------------------------------------------------------------------------
alter table public.volunteer_groups  enable row level security;
alter table public.volunteers        enable row level security;
alter table public.volunteer_seasons enable row level security;

drop policy if exists volunteer_groups_select_member on public.volunteer_groups;
create policy volunteer_groups_select_member on public.volunteer_groups
  for select using (auth.uid() is not null);

drop policy if exists volunteer_groups_admin_all on public.volunteer_groups;
create policy volunteer_groups_admin_all on public.volunteer_groups
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists volunteers_select_member on public.volunteers;
create policy volunteers_select_member on public.volunteers
  for select using (auth.uid() is not null);

drop policy if exists volunteers_admin_all on public.volunteers;
create policy volunteers_admin_all on public.volunteers
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists volunteer_seasons_select_member on public.volunteer_seasons;
create policy volunteer_seasons_select_member on public.volunteer_seasons
  for select using (auth.uid() is not null);

drop policy if exists volunteer_seasons_admin_all on public.volunteer_seasons;
create policy volunteer_seasons_admin_all on public.volunteer_seasons
  for all using (public.is_admin()) with check (public.is_admin());

-- Signed-out visitors read the public view below and nothing else.
revoke select, insert, update, delete on public.volunteers        from anon;
revoke select, insert, update, delete on public.volunteer_seasons from anon;
revoke select, insert, update, delete on public.volunteer_groups  from anon;

-- ---------------------------------------------------------------------------
-- Public view for /about
--
-- SECURITY DEFINER (the default), like the 0009 bulletin views: it runs as the
-- owner and bypasses RLS, so its column list and WHERE clause are the entire
-- boundary. It exposes exactly two columns. Email, WeChat and notes cannot leak
-- to the public page because they are structurally absent, not because the
-- caller remembers not to select them.
-- ---------------------------------------------------------------------------
drop view if exists public.volunteers_public;
create view public.volunteers_public
with (security_invoker = false) as
select
  v.id,
  v.full_name,
  coalesce(
    array_agg(c.name order by c.starts_at desc nulls last, c.name desc)
      filter (where c.name is not null),
    '{}'::text[]
  ) as seasons
from public.volunteers v
left join public.volunteer_seasons vs on vs.volunteer_id = v.id
left join public.cohorts c            on c.id = vs.cohort_id
where v.is_public
group by v.id, v.full_name;

revoke all on public.volunteers_public from anon, authenticated;
grant select on public.volunteers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Import RPC
--
-- Same two-phase shape as admin_import_roster (0004) — validate the whole file
-- before touching a row — with one deliberate difference: every failing row is
-- collected and returned together. admin_import_roster raises on the first
-- problem, so an admin with twenty bad rows fixes them one upload at a time.
--
-- Matching order is email first, name second. A row whose email matches an
-- existing volunteer under a different name is a conflict, not an update, and
-- it fails the whole file.
--
-- Blank cells never erase stored data: an absent email/WeChat/note on an update
-- leaves the existing value alone. Clearing a field is done in the UI, where it
-- is unambiguous.
-- ---------------------------------------------------------------------------
create or replace function public.admin_import_volunteers(
  p_rows jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item          jsonb;
  season        jsonb;
  idx           integer := 0;
  v_name        text;
  v_name_key    text;
  v_email       text;
  v_email_key   text;
  v_wechat      text;
  v_notes       text;
  v_is_public   boolean;
  v_seasons     jsonb;
  v_season_name text;
  v_group_name  text;
  v_cohort_id   uuid;
  v_group_id    uuid;
  v_id          uuid;
  v_is_new      boolean;
  e_id          uuid;
  e_full_name   text;
  e_name_key    text;
  e_email       text;
  e_email_key   text;
  errors        jsonb := '[]'::jsonb;
  added         jsonb := '[]'::jsonb;
  updated       jsonb := '[]'::jsonb;
  summary       jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'EMPTY_IMPORT';
  end if;

  -- --- Phase 1: validate every row, write nothing --------------------------
  for item in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    v_name      := btrim(coalesce(item ->> 'full_name', ''));
    v_name_key  := lower(v_name);
    v_email     := btrim(coalesce(item ->> 'email', ''));
    v_email_key := nullif(lower(v_email), '');
    v_seasons   := coalesce(item -> 'seasons', '[]'::jsonb);

    if v_name = '' then
      errors := errors || jsonb_build_object('row', idx, 'code', 'INVALID_NAME');
      continue;
    end if;

    if v_email <> '' and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'INVALID_EMAIL', 'name', v_name, 'value', v_email);
    end if;

    if jsonb_typeof(v_seasons) <> 'array' or jsonb_array_length(v_seasons) = 0 then
      errors := errors || jsonb_build_object('row', idx, 'code', 'NO_SEASON', 'name', v_name);
    else
      for season in select value from jsonb_array_elements(v_seasons)
      loop
        v_season_name := btrim(coalesce(season ->> 'season', ''));
        v_group_name  := nullif(btrim(coalesce(season ->> 'group', '')), '');

        if v_season_name = '' then
          errors := errors || jsonb_build_object('row', idx, 'code', 'NO_SEASON', 'name', v_name);
        elsif not exists (
          select 1 from public.cohorts c
          where lower(btrim(c.name)) = lower(v_season_name)
        ) then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'UNKNOWN_SEASON', 'name', v_name, 'value', v_season_name);
        end if;

        if v_group_name is not null and not exists (
          select 1 from public.volunteer_groups g
          where lower(btrim(g.name)) = lower(v_group_name)
        ) then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'UNKNOWN_GROUP', 'name', v_name, 'value', v_group_name);
        end if;
      end loop;
    end if;

    -- Conflicts inside the uploaded file itself.
    if v_email_key is not null and exists (
      select 1 from jsonb_array_elements(p_rows) other
      where nullif(lower(btrim(coalesce(other.value ->> 'email', ''))), '') = v_email_key
        and lower(btrim(coalesce(other.value ->> 'full_name', ''))) <> v_name_key
    ) then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'FILE_DUP_EMAIL', 'name', v_name, 'value', v_email_key);
    end if;

    if exists (
      select 1 from jsonb_array_elements(p_rows) other
      where lower(btrim(coalesce(other.value ->> 'full_name', ''))) = v_name_key
        and nullif(lower(btrim(coalesce(other.value ->> 'email', ''))), '')
            is distinct from v_email_key
    ) then
      errors := errors || jsonb_build_object(
        'row', idx, 'code', 'FILE_DUP_NAME', 'name', v_name, 'value', v_name);
    end if;

    -- Conflicts against what is already stored.
    e_id := null; e_full_name := null; e_name_key := null;
    e_email := null; e_email_key := null;

    if v_email_key is not null then
      select v.id, v.full_name, v.name_key, v.email, v.email_key
        into e_id, e_full_name, e_name_key, e_email, e_email_key
        from public.volunteers v
       where v.email_key = v_email_key;
    end if;

    if e_id is not null then
      if e_name_key <> v_name_key then
        errors := errors || jsonb_build_object(
          'row', idx, 'code', 'NAME_MISMATCH',
          'name', v_name, 'value', v_email_key, 'detail', e_full_name);
      end if;
    else
      select v.id, v.full_name, v.name_key, v.email, v.email_key
        into e_id, e_full_name, e_name_key, e_email, e_email_key
        from public.volunteers v
       where v.name_key = v_name_key;

      if e_id is not null
         and e_email_key is not null
         and v_email_key is not null
         and e_email_key <> v_email_key then
        errors := errors || jsonb_build_object(
          'row', idx, 'code', 'EMAIL_MISMATCH',
          'name', v_name, 'value', v_email, 'detail', e_email);
      end if;
    end if;
  end loop;

  if jsonb_array_length(errors) > 0 then
    return jsonb_build_object(
      'ok', false, 'dry_run', p_dry_run,
      'errors', errors, 'added', '[]'::jsonb, 'updated', '[]'::jsonb);
  end if;

  -- --- Phase 2: classify, and write unless this is a dry run ---------------
  idx := 0;
  for item in select value from jsonb_array_elements(p_rows)
  loop
    idx := idx + 1;
    v_name      := btrim(coalesce(item ->> 'full_name', ''));
    v_name_key  := lower(v_name);
    -- Stored lowercased so the import agrees with the add/edit dialog, which
    -- normalises the same way. Phase 1 validates and reports the raw value, so
    -- an error message still quotes what the admin actually typed.
    v_email     := lower(nullif(btrim(coalesce(item ->> 'email', '')), ''));
    v_email_key := v_email;
    v_wechat    := nullif(btrim(coalesce(item ->> 'wechat_number', '')), '');
    v_notes     := nullif(btrim(coalesce(item ->> 'notes', '')), '');
    v_is_public := (item ->> 'is_public')::boolean;
    v_seasons   := coalesce(item -> 'seasons', '[]'::jsonb);

    v_id := null;
    if v_email_key is not null then
      select v.id into v_id from public.volunteers v where v.email_key = v_email_key;
    end if;
    if v_id is null then
      select v.id into v_id from public.volunteers v where v.name_key = v_name_key;
    end if;
    v_is_new := v_id is null;

    if not p_dry_run then
      if v_is_new then
        insert into public.volunteers (full_name, email, wechat_number, notes, is_public)
        values (v_name, v_email, v_wechat, v_notes, coalesce(v_is_public, true))
        returning id into v_id;
      else
        update public.volunteers v
           set full_name     = v_name,
               email         = coalesce(v_email, v.email),
               wechat_number = coalesce(v_wechat, v.wechat_number),
               notes         = coalesce(v_notes, v.notes),
               is_public     = coalesce(v_is_public, v.is_public)
         where v.id = v_id;
      end if;

      for season in select value from jsonb_array_elements(v_seasons)
      loop
        select c.id into v_cohort_id
          from public.cohorts c
         where lower(btrim(c.name)) = lower(btrim(season ->> 'season'))
         limit 1;

        v_group_id   := null;
        v_group_name := nullif(btrim(coalesce(season ->> 'group', '')), '');
        if v_group_name is not null then
          select g.id into v_group_id
            from public.volunteer_groups g
           where lower(btrim(g.name)) = lower(v_group_name)
           limit 1;
        end if;

        insert into public.volunteer_seasons (volunteer_id, cohort_id, group_id)
        values (v_id, v_cohort_id, v_group_id)
        -- A blank group cell must not wipe a group that is already recorded,
        -- so the stored value wins when the incoming one is null.
        on conflict (volunteer_id, cohort_id) do update
          set group_id = coalesce(excluded.group_id, volunteer_seasons.group_id);
      end loop;
    end if;

    summary := jsonb_build_object(
      'row', idx,
      'full_name', v_name,
      'email', v_email,
      'seasons', (
        select coalesce(jsonb_agg(s.value ->> 'season'), '[]'::jsonb)
        from jsonb_array_elements(v_seasons) s
      )
    );

    if v_is_new then
      added := added || summary;
    else
      updated := updated || summary;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'dry_run', p_dry_run,
    'errors', '[]'::jsonb, 'added', added, 'updated', updated);
end;
$$;

revoke all on function public.admin_import_volunteers(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_import_volunteers(jsonb, boolean) to service_role;
