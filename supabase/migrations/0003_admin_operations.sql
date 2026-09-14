-- Atomic privileged imports and tighter protection for privilege-bearing fields.

create unique index if not exists idx_roster_invites_cohort_normalized_email
  on public.roster_invites (cohort_id, lower(trim(email)));

create or replace function public.admin_import_roster(
  p_cohort_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  item_email text;
  item_role public.user_role;
  item_number integer := 0;
  result jsonb;
begin
  if not exists (select 1 from public.cohorts where id = p_cohort_id) then
    raise exception 'COHORT_NOT_FOUND';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'EMPTY_ROSTER';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    item_number := item_number + 1;
    item_email := lower(trim(item ->> 'email'));
    begin
      item_role := (item ->> 'role')::public.user_role;
    exception when invalid_text_representation then
      raise exception 'ROW_%_INVALID_ROLE', item_number;
    end;

    if item_email = '' then
      raise exception 'ROW_%_INVALID_EMAIL', item_number;
    end if;
    if exists (
      select 1
      from public.roster_invites ri
      where lower(trim(ri.email)) = item_email
        and ri.role <> item_role
    ) then
      raise exception 'ROW_%_ROLE_CONFLICT', item_number;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_rows) other
      where lower(trim(other ->> 'email')) = item_email
        and (other ->> 'role') <> item ->> 'role'
    ) then
      raise exception 'ROW_%_ROLE_CONFLICT', item_number;
    end if;
  end loop;

  with input as (
    select
      ordinal::integer as row_number,
      lower(trim(value ->> 'email')) as email,
      trim(value ->> 'full_name') as full_name,
      (value ->> 'role')::public.user_role as role
    from jsonb_array_elements(p_rows) with ordinality source(value, ordinal)
  ),
  first_rows as (
    select distinct on (email) *
    from input
    order by email, row_number
  ),
  inserted as (
    insert into public.roster_invites (cohort_id, email, full_name, role)
    select p_cohort_id, email, full_name, role
    from first_rows
    where not exists (
      select 1 from public.roster_invites existing
      where existing.cohort_id = p_cohort_id
        and lower(trim(existing.email)) = first_rows.email
    )
    on conflict (cohort_id, email) do nothing
    returning *
  )
  select jsonb_build_object(
    'added',
    coalesce((select jsonb_agg(to_jsonb(added) order by added.invited_at) from inserted added), '[]'::jsonb),
    'skipped',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'row', jsonb_build_object(
            'email', source.email,
            'full_name', source.full_name,
            'role', source.role
          ),
          'reason',
          case
            when source.row_number <> (
              select min(candidate.row_number)
              from input candidate
              where candidate.email = source.email
            )
              then '文件内邮箱重复'
            else '该项目中已存在此邮箱'
          end
        )
        order by source.row_number
      )
      from input source
      where source.row_number <> (
        select min(candidate.row_number) from input candidate where candidate.email = source.email
      )
      or exists (
        select 1 from public.roster_invites existing
        where existing.cohort_id = p_cohort_id
          and lower(trim(existing.email)) = source.email
          and not exists (select 1 from inserted added where added.id = existing.id)
      )
    ), '[]'::jsonb),
    'errors', '[]'::jsonb
  )
  into result;

  return result;
end;
$$;

create or replace function public.admin_import_matches(
  p_cohort_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  mentor uuid;
  mentee uuid;
  item_number integer := 0;
  result jsonb;
begin
  if not exists (select 1 from public.cohorts where id = p_cohort_id) then
    raise exception 'COHORT_NOT_FOUND';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'EMPTY_MATCHES';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    item_number := item_number + 1;
    begin
      mentor := (item ->> 'mentor_id')::uuid;
      mentee := (item ->> 'mentee_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'ROW_%_INVALID_ID', item_number;
    end;

    if not exists (
      select 1 from public.profiles p
      where p.id = mentor
        and p.role = 'mentor'
        and p_cohort_id = any(p.cohort_ids)
    ) then
      raise exception 'ROW_%_INVALID_MENTOR', item_number;
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = mentee
        and p.role = 'mentee'
        and p_cohort_id = any(p.cohort_ids)
    ) then
      raise exception 'ROW_%_INVALID_MENTEE', item_number;
    end if;
  end loop;

  with input as (
    select
      ordinal::integer as row_number,
      (value ->> 'mentor_id')::uuid as mentor_id,
      (value ->> 'mentee_id')::uuid as mentee_id
    from jsonb_array_elements(p_rows) with ordinality source(value, ordinal)
  ),
  first_rows as (
    select distinct on (mentor_id, mentee_id) *
    from input
    order by mentor_id, mentee_id, row_number
  ),
  inserted as (
    insert into public.matches (cohort_id, mentor_id, mentee_id)
    select p_cohort_id, mentor_id, mentee_id
    from first_rows
    on conflict (cohort_id, mentor_id, mentee_id) do nothing
    returning *
  )
  select jsonb_build_object(
    'added',
    coalesce((select jsonb_agg(to_jsonb(added) order by added.created_at) from inserted added), '[]'::jsonb),
    'skipped',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'row', jsonb_build_object(
            'mentor_id', source.mentor_id,
            'mentee_id', source.mentee_id
          ),
          'reason',
          case
            when source.row_number <> (
              select min(candidate.row_number)
              from input candidate
              where candidate.mentor_id = source.mentor_id
                and candidate.mentee_id = source.mentee_id
            ) then '文件内配对重复'
            else '该配对已存在'
          end
        )
        order by source.row_number
      )
      from input source
      where source.row_number <> (
        select min(candidate.row_number)
        from input candidate
        where candidate.mentor_id = source.mentor_id
          and candidate.mentee_id = source.mentee_id
      )
      or exists (
        select 1 from public.matches existing
        where existing.cohort_id = p_cohort_id
          and existing.mentor_id = source.mentor_id
          and existing.mentee_id = source.mentee_id
          and not exists (select 1 from inserted added where added.id = existing.id)
      )
    ), '[]'::jsonb),
    'errors', '[]'::jsonb
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_import_roster(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.admin_import_matches(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_roster(uuid, jsonb) to service_role;
grant execute on function public.admin_import_matches(uuid, jsonb) to service_role;

-- Authors do not need post editing; keeping moderation admin-only prevents an
-- author from changing the hidden flag through the generic update policy.
drop policy if exists bulletin_update_author_admin on public.bulletin_posts;
drop policy if exists bulletin_update_admin on public.bulletin_posts;
create policy bulletin_update_admin on public.bulletin_posts
  for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id
    or new.role is distinct from old.role
    or new.cohort_ids is distinct from old.cohort_ids
    or new.email is distinct from old.email
    or new.admin_notes is distinct from old.admin_notes
  ) then
    raise exception 'PROFILE_PRIVILEGED_FIELDS';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privileges on public.profiles;
create trigger trg_profiles_protect_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();
