-- Group leads, and groups that automatically contain them.
--
-- 战略组 is not a fourth parallel group — it is a layer sitting on top of the
-- others: the leads of 运营组 / 项目组 / 人事组, plus whoever belongs to it
-- directly. Somebody can therefore be in 运营组 and 战略组 in the same season,
-- which `unique (volunteer_id, cohort_id)` forbids.
--
-- Rather than relax that constraint (and make every list "which group, of
-- possibly several"), the overlap is modelled as what it actually is: a role.
-- `is_lead` marks the lead of a working group for one season, and a group
-- carrying `includes_leads` shows every lead alongside its own members.
--
-- `includes_leads` is a column, not a hardcoded name, so 战略组 keeps no special
-- status in the code and a differently-named leadership group later is a row
-- edit, not a patch.

alter table public.volunteer_seasons
  add column if not exists is_lead boolean not null default false;

alter table public.volunteer_groups
  add column if not exists includes_leads boolean not null default false;

comment on column public.volunteer_seasons.is_lead is
  '本季度担任所在组的负责人。带 includes_leads 的组会自动包含所有负责人。';
comment on column public.volunteer_groups.includes_leads is
  '该组自动包含当季所有负责人，而不只是直接归属该组的人。';

update public.volunteer_groups
   set includes_leads = true
 where name = '战略组'
   and includes_leads = false;

create index if not exists idx_volunteer_seasons_lead
  on public.volunteer_seasons (cohort_id)
  where is_lead;

-- ---------------------------------------------------------------------------
-- Import: a season cell may mark the lead role
--
--   2026春季:运营组          — member of 运营组
--   2026春季:运营组(负责人)   — lead of 运营组, and therefore also in 战略组
--
-- The marker stays inside the season cell so leadership remains per-season,
-- like the group itself. A separate column could only say "is a lead", never
-- "was a lead in 2025春季".
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
  v_is_lead     boolean;
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

        -- A lead leads a group; marking one without naming a group would leave
        -- 战略组 membership with no working group behind it.
        if coalesce((season ->> 'is_lead')::boolean, false) and v_group_name is null then
          errors := errors || jsonb_build_object(
            'row', idx, 'code', 'LEAD_WITHOUT_GROUP', 'name', v_name, 'value', v_season_name);
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
        v_is_lead := coalesce((season ->> 'is_lead')::boolean, false);

        -- A blank group cell must not wipe a group that is already recorded,
        -- so the stored value wins when the incoming one is null. `is_lead` is
        -- different: it is always present in a parsed row (true or false), so
        -- an import is the authority on it and can also clear it.
        insert into public.volunteer_seasons (volunteer_id, cohort_id, group_id, is_lead)
        values (v_id, v_cohort_id, v_group_id, v_is_lead)
        on conflict (volunteer_id, cohort_id) do update
          set group_id = coalesce(excluded.group_id, volunteer_seasons.group_id),
              is_lead  = excluded.is_lead;
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
