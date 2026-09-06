-- Link volunteers to portal accounts, and resolve their details from the
-- profile when one exists.
--
-- After 0010/0011 the two lists were entirely disconnected: 7 profiles, 94
-- volunteers, 0 links. The same people appear in both — five volunteers share a
-- name with a profile — but nothing tied them together, so a volunteer who
-- updated their WeChat in 我的资料 saw no change in the roster.
--
-- The rule is: **the portal profile wins when a link exists.** There is no
-- two-way sync — nothing to conflict, nothing to overwrite. Resolution happens
-- at read time in `volunteers_resolved`, so the answer cannot go stale.
--
-- Linking is by email only. Sharing a name is not evidence of being the same
-- person — that is the same principle the import's NAME_MISMATCH check
-- enforces — so name matches are surfaced in the admin UI for a human to
-- confirm, never joined automatically.

-- ---------------------------------------------------------------------------
-- 1. Backfill existing links
-- ---------------------------------------------------------------------------
update public.volunteers v
   set profile_id = p.id
  from public.profiles p
 where v.profile_id is null
   and v.email_key is not null
   and v.email_key = lower(btrim(p.email));

-- ---------------------------------------------------------------------------
-- 2. Keep links fresh
--
-- Without these, a link is only ever as good as the moment it was made: a
-- volunteer given an email tomorrow, or a profile created next season, would
-- stay unlinked forever.
-- ---------------------------------------------------------------------------
create or replace function public.link_volunteer_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- An explicit link set by an admin is never overwritten here; only the
  -- automatic email match is (re)computed. OLD is unassigned on INSERT, so it
  -- may only be read once TG_OP has ruled that branch out.
  if new.profile_id is null
     or (tg_op = 'UPDATE' and new.email is distinct from old.email) then
    new.profile_id := coalesce(
      (select p.id from public.profiles p
        where lower(btrim(p.email)) = nullif(lower(btrim(new.email)), '')
        limit 1),
      new.profile_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_volunteers_link_profile on public.volunteers;
create trigger trg_volunteers_link_profile
  before insert or update of email, profile_id on public.volunteers
  for each row execute function public.link_volunteer_to_profile();

-- The other direction: a new account (or a changed email) claims the matching
-- volunteer row.
create or replace function public.link_profile_to_volunteer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and btrim(new.email) <> '' then
    update public.volunteers v
       set profile_id = new.id
     where v.profile_id is null
       and v.email_key = lower(btrim(new.email));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_link_volunteer on public.profiles;
create trigger trg_profiles_link_volunteer
  after insert or update of email on public.profiles
  for each row execute function public.link_profile_to_volunteer();

-- ---------------------------------------------------------------------------
-- 3. Read-time resolution: the profile wins where it has a value
-- ---------------------------------------------------------------------------
drop view if exists public.volunteers_resolved;
create view public.volunteers_resolved
with (security_invoker = true) as
select
  v.id,
  v.profile_id,
  coalesce(nullif(btrim(p.full_name), ''), v.full_name)         as full_name,
  coalesce(nullif(btrim(p.email), ''), v.email)                 as email,
  coalesce(nullif(btrim(p.wechat_number), ''), v.wechat_number) as wechat_number,
  p.avatar_url,
  -- Operational fields stay the volunteer roster's own.
  v.notes,
  v.is_public,
  -- The stored values, so the edit dialog can show what it would fall back to.
  v.full_name     as own_full_name,
  v.email         as own_email,
  v.wechat_number as own_wechat_number,
  v.name_key,
  v.email_key,
  v.created_at,
  v.updated_at
from public.volunteers v
left join public.profiles p on p.id = v.profile_id;

-- security_invoker = true (unlike the 0009 bulletin views): this one must run
-- as the caller so the existing RLS on `volunteers` and `profiles` still
-- applies. It widens no access — it only joins what the caller may already read.
revoke all on public.volunteers_resolved from anon, authenticated;
grant select on public.volunteers_resolved to authenticated;

-- ---------------------------------------------------------------------------
-- 4. The public /about list follows the resolved name
--
-- So a volunteer who renames themselves in 我的资料 is credited under that name
-- on the public page. The column list is UNCHANGED and deliberately narrow:
-- joining profiles must not become a way for an email to reach a page that
-- anonymous visitors can read. Two columns plus the id, exactly as before.
-- ---------------------------------------------------------------------------
drop view if exists public.volunteers_public;
create view public.volunteers_public
with (security_invoker = false) as
select
  v.id,
  coalesce(nullif(btrim(p.full_name), ''), v.full_name) as full_name,
  coalesce(
    array_agg(c.name order by c.starts_at desc nulls last, c.name desc)
      filter (where c.name is not null),
    '{}'::text[]
  ) as seasons
from public.volunteers v
left join public.profiles p           on p.id = v.profile_id
left join public.volunteer_seasons vs on vs.volunteer_id = v.id
left join public.cohorts c            on c.id = vs.cohort_id
where v.is_public
group by v.id, p.full_name, v.full_name;

revoke all on public.volunteers_public from anon, authenticated;
grant select on public.volunteers_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Season matching ignores internal whitespace
--
-- The seasons in `cohorts` are spelled two ways: the portal's own are '2025 春季'
-- and '2026 秋季' (with a space), the ones backfilled in 0011 are '2025夏季' and
-- '2024冬季' (without). An admin typing either spelling into the import
-- spreadsheet should hit the same season instead of "季度不存在".
-- ---------------------------------------------------------------------------
create or replace function public.season_key(value text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(value, ''), '\s', '', 'g'));
$$;

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
          where public.season_key(c.name) = public.season_key(v_season_name)
        ) then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'UNKNOWN_SEASON', 'name', v_name, 'value', v_season_name);
        end if;

        if v_group_name is not null and not exists (
          select 1 from public.volunteer_groups g
          where public.season_key(g.name) = public.season_key(v_group_name)
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
         where public.season_key(c.name) = public.season_key(season ->> 'season')
         limit 1;

        v_group_id   := null;
        v_group_name := nullif(btrim(coalesce(season ->> 'group', '')), '');
        if v_group_name is not null then
          select g.id into v_group_id
            from public.volunteer_groups g
           where public.season_key(g.name) = public.season_key(v_group_name)
           limit 1;
        end if;

        -- A blank group cell must not wipe a group that is already recorded,
        -- so the stored value wins when the incoming one is null.
        insert into public.volunteer_seasons (volunteer_id, cohort_id, group_id)
        values (v_id, v_cohort_id, v_group_id)
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

revoke all on function public.link_volunteer_to_profile() from public, anon, authenticated;
revoke all on function public.link_profile_to_volunteer() from public, anon, authenticated;
