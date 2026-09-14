-- Composable portal identity: optional participant role plus admin/volunteer flags.

do $$ begin
  create type public.participant_role as enum ('mentor', 'mentee');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists participant_role public.participant_role,
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_volunteer boolean not null default false;

alter table public.roster_invites
  add column if not exists participant_role public.participant_role,
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_volunteer boolean not null default false;

update public.profiles
set
  participant_role = case
    when role::text in ('mentor', 'mentee')
      then role::text::public.participant_role
    else null
  end,
  is_admin = role::text = 'admin'
where participant_role is null
  and is_admin = false
  and is_volunteer = false;

update public.roster_invites
set
  participant_role = case
    when role::text in ('mentor', 'mentee')
      then role::text::public.participant_role
    else null
  end,
  is_admin = role::text = 'admin'
where participant_role is null
  and is_admin = false
  and is_volunteer = false;

alter table public.profiles
  drop constraint if exists profiles_has_identity;
alter table public.profiles
  add constraint profiles_has_identity check (
    participant_role is not null or is_admin or is_volunteer
  );
alter table public.profiles
  drop constraint if exists profiles_has_cohort;
alter table public.profiles
  add constraint profiles_has_cohort check (cardinality(cohort_ids) > 0);

alter table public.roster_invites
  drop constraint if exists roster_invites_has_identity;
alter table public.roster_invites
  add constraint roster_invites_has_identity check (
    participant_role is not null or is_admin or is_volunteer
  );

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin
  );
$$;

create or replace function public.is_participant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.participant_role is not null
  );
$$;

create or replace function public.is_mentee()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.participant_role = 'mentee'
  );
$$;

revoke all on function public.is_participant() from public;
revoke all on function public.is_mentee() from public;
grant execute on function public.is_participant() to authenticated;
grant execute on function public.is_mentee() to authenticated;

create or replace function public.can_upload_avatar()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    public.is_admin()
    or public.is_participant()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_volunteer
    )
    or exists (
      select 1
      from public.roster_invites ri
      where lower(trim(ri.email)) = lower(trim(auth.jwt() ->> 'email'))
        and (ri.claimed_user_id is null or ri.claimed_user_id = auth.uid())
        and (ri.is_admin or ri.is_volunteer or ri.participant_role is not null)
    );
$$;

revoke all on function public.can_upload_avatar() from public;
grant execute on function public.can_upload_avatar() to authenticated;

drop policy if exists bulletin_insert_self on public.bulletin_posts;
create policy bulletin_insert_self on public.bulletin_posts
  for insert with check (
    (public.is_admin() or public.is_participant())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists participation_insert_self on public.participation_records;
create policy participation_insert_self on public.participation_records
  for insert with check (
    (public.is_admin() or public.is_mentee())
    and mentee_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists participation_modify_own on public.participation_records;
create policy participation_modify_own on public.participation_records
  for update using (
    public.is_admin() or (public.is_mentee() and mentee_id = auth.uid())
  )
  with check (
    public.is_admin() or (public.is_mentee() and mentee_id = auth.uid())
  );

drop policy if exists participation_delete_own on public.participation_records;
create policy participation_delete_own on public.participation_records
  for delete using (
    public.is_admin() or (public.is_mentee() and mentee_id = auth.uid())
  );

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.can_upload_avatar()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_upload_avatar()
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and public.can_upload_avatar()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and public.can_upload_avatar()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_select_allowed on storage.objects;
create policy participation_select_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'participation'
    and (
      public.is_admin()
      or (public.is_mentee() and (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

drop policy if exists participation_insert_own on storage.objects;
create policy participation_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'participation'
    and (public.is_admin() or public.is_mentee())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_update_own on storage.objects;
create policy participation_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'participation'
    and (public.is_admin() or public.is_mentee())
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'participation'
    and (public.is_admin() or public.is_mentee())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_delete_own on storage.objects;
create policy participation_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'participation'
    and (public.is_admin() or public.is_mentee())
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create or replace function public.get_onboarding_invite()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  user_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  verified_email text;
  result jsonb;
begin
  if auth.uid() is null or user_email is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select lower(trim(u.email)) into verified_email
  from auth.users u
  where u.id = auth.uid();
  if verified_email is null or verified_email <> user_email then
    raise exception 'AUTH_EMAIL_MISMATCH';
  end if;

  select jsonb_build_object(
    'fullName', first_invite.full_name,
    'participantRole', first_invite.participant_role,
    'isAdmin', first_invite.is_admin,
    'isVolunteer', first_invite.is_volunteer,
    'cohortIds', coalesce(array_agg(distinct ri.cohort_id), '{}'::uuid[]),
    'cohortNames', coalesce(array_agg(distinct c.name), '{}'::text[])
  )
  into result
  from public.roster_invites ri
  join public.cohorts c on c.id = ri.cohort_id
  cross join lateral (
    select
      candidate.full_name,
      candidate.participant_role,
      candidate.is_admin,
      candidate.is_volunteer
    from public.roster_invites candidate
    where lower(trim(candidate.email)) = user_email
      and (candidate.claimed_user_id is null or candidate.claimed_user_id = auth.uid())
    order by candidate.invited_at, candidate.id
    limit 1
  ) first_invite
  where lower(trim(ri.email)) = user_email
    and (ri.claimed_user_id is null or ri.claimed_user_id = auth.uid())
    and ri.participant_role is not distinct from first_invite.participant_role
    and ri.is_admin = first_invite.is_admin
    and ri.is_volunteer = first_invite.is_volunteer
  group by
    first_invite.full_name,
    first_invite.participant_role,
    first_invite.is_admin,
    first_invite.is_volunteer;

  return result;
end;
$$;

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
  item_participant_role public.participant_role;
  item_is_admin boolean;
  item_is_volunteer boolean;
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
    item_participant_role :=
      nullif(trim(item ->> 'participant_role'), '')::public.participant_role;
    item_is_admin := coalesce((item ->> 'is_admin')::boolean, false);
    item_is_volunteer := coalesce((item ->> 'is_volunteer')::boolean, false);

    if item_email = '' then
      raise exception 'ROW_%_INVALID_EMAIL', item_number;
    end if;
    if item_participant_role is null and not item_is_admin and not item_is_volunteer then
      raise exception 'ROW_%_EMPTY_IDENTITY', item_number;
    end if;
    if exists (
      select 1
      from public.roster_invites ri
      where lower(trim(ri.email)) = item_email
        and (
          ri.participant_role is distinct from item_participant_role
          or ri.is_admin <> item_is_admin
          or ri.is_volunteer <> item_is_volunteer
        )
    ) then
      raise exception 'ROW_%_ROLE_CONFLICT', item_number;
    end if;
    if exists (
      select 1
      from jsonb_array_elements(p_rows) other
      where lower(trim(other ->> 'email')) = item_email
        and (
          nullif(trim(other ->> 'participant_role'), '') is distinct from
            nullif(trim(item ->> 'participant_role'), '')
          or coalesce((other ->> 'is_admin')::boolean, false) <> item_is_admin
          or coalesce((other ->> 'is_volunteer')::boolean, false) <> item_is_volunteer
        )
    ) then
      raise exception 'ROW_%_ROLE_CONFLICT', item_number;
    end if;
  end loop;

  with input as (
    select
      ordinal::integer as row_number,
      lower(trim(value ->> 'email')) as email,
      trim(value ->> 'full_name') as full_name,
      nullif(trim(value ->> 'participant_role'), '')::public.participant_role
        as participant_role,
      coalesce((value ->> 'is_admin')::boolean, false) as is_admin,
      coalesce((value ->> 'is_volunteer')::boolean, false) as is_volunteer
    from jsonb_array_elements(p_rows) with ordinality source(value, ordinal)
  ),
  first_rows as (
    select distinct on (email) *
    from input
    order by email, row_number
  ),
  inserted as (
    insert into public.roster_invites (
      cohort_id,
      email,
      full_name,
      participant_role,
      is_admin,
      is_volunteer
    )
    select
      p_cohort_id,
      email,
      full_name,
      participant_role,
      is_admin,
      is_volunteer
    from first_rows
    where not exists (
      select 1 from public.roster_invites existing
      where existing.cohort_id = p_cohort_id
        and lower(trim(existing.email)) = first_rows.email
    )
    on conflict do nothing
    returning *
  )
  select jsonb_build_object(
    'added',
    coalesce(
      (select jsonb_agg(to_jsonb(added) order by added.invited_at) from inserted added),
      '[]'::jsonb
    ),
    'skipped',
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'row', jsonb_build_object(
            'email', source.email,
            'full_name', source.full_name,
            'participant_role', source.participant_role,
            'is_admin', source.is_admin,
            'is_volunteer', source.is_volunteer
          ),
          'reason',
          case
            when source.row_number <> (
              select min(candidate.row_number)
              from input candidate
              where candidate.email = source.email
            ) then '文件内邮箱重复'
            else '该项目中已存在此邮箱'
          end
        )
        order by source.row_number
      )
      from input source
      where source.row_number <> (
        select min(candidate.row_number)
        from input candidate
        where candidate.email = source.email
      )
      or exists (
        select 1 from public.roster_invites existing
        where existing.cohort_id = p_cohort_id
          and lower(trim(existing.email)) = source.email
          and not exists (
            select 1 from inserted added where added.id = existing.id
          )
      )
    ), '[]'::jsonb),
    'errors', '[]'::jsonb
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_import_roster(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_import_roster(uuid, jsonb) to service_role;

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
        and p.participant_role = 'mentor'
        and p_cohort_id = any(p.cohort_ids)
    ) then
      raise exception 'ROW_%_INVALID_MENTOR', item_number;
    end if;
    if not exists (
      select 1 from public.profiles p
      where p.id = mentee
        and p.participant_role = 'mentee'
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
    coalesce(
      (select jsonb_agg(to_jsonb(added) order by added.created_at) from inserted added),
      '[]'::jsonb
    ),
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
          and not exists (
            select 1 from inserted added where added.id = existing.id
          )
      )
    ), '[]'::jsonb),
    'errors', '[]'::jsonb
  )
  into result;

  return result;
end;
$$;

revoke all on function public.admin_import_matches(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.admin_import_matches(uuid, jsonb) to service_role;

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and (
    new.id is distinct from old.id
    or new.participant_role is distinct from old.participant_role
    or new.is_admin is distinct from old.is_admin
    or new.is_volunteer is distinct from old.is_volunteer
    or new.cohort_ids is distinct from old.cohort_ids
    or new.email is distinct from old.email
    or new.admin_notes is distinct from old.admin_notes
  ) then
    raise exception 'PROFILE_PRIVILEGED_FIELDS';
  end if;
  return new;
end;
$$;

create or replace function public.claim_roster_invite(
  p_full_name text,
  p_wechat_number text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_id uuid := auth.uid();
  user_email text := nullif(lower(trim(auth.jwt() ->> 'email')), '');
  verified_email text;
  invite_participant_role public.participant_role;
  invite_is_admin boolean;
  invite_is_volunteer boolean;
  invite_cohorts uuid[];
  identity_count integer;
  claimed_profile public.profiles;
begin
  if user_id is null or user_email is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select lower(trim(u.email)) into verified_email
  from auth.users u
  where u.id = user_id;
  if verified_email is null or verified_email <> user_email then
    raise exception 'AUTH_EMAIL_MISMATCH';
  end if;
  if nullif(trim(p_full_name), '') is null or length(trim(p_full_name)) > 200 then
    raise exception 'INVALID_PROFILE';
  end if;

  perform 1
  from public.roster_invites ri
  where lower(trim(ri.email)) = user_email
    and (ri.claimed_user_id is null or ri.claimed_user_id = user_id)
  for update;

  if exists (select 1 from public.profiles p where p.id = user_id) then
    raise exception 'ALREADY_ONBOARDED';
  end if;

  select
    min(ri.participant_role::text)::public.participant_role,
    bool_or(ri.is_admin),
    bool_or(ri.is_volunteer),
    array_agg(distinct ri.cohort_id),
    count(distinct (
      coalesce(ri.participant_role::text, 'none'),
      ri.is_admin,
      ri.is_volunteer
    ))
  into
    invite_participant_role,
    invite_is_admin,
    invite_is_volunteer,
    invite_cohorts,
    identity_count
  from public.roster_invites ri
  where lower(trim(ri.email)) = user_email
    and (ri.claimed_user_id is null or ri.claimed_user_id = user_id);

  if invite_cohorts is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;
  if identity_count <> 1 then
    raise exception 'INVITE_ROLE_CONFLICT';
  end if;

  insert into public.profiles (
    id,
    participant_role,
    is_admin,
    is_volunteer,
    cohort_ids,
    full_name,
    email,
    wechat_number,
    avatar_url,
    visible
  )
  values (
    user_id,
    invite_participant_role,
    invite_is_admin,
    invite_is_volunteer,
    invite_cohorts,
    trim(p_full_name),
    user_email,
    nullif(trim(p_wechat_number), ''),
    case
      when invite_is_admin or invite_is_volunteer or invite_participant_role is not null
        then nullif(trim(p_avatar_url), '')
      else null
    end,
    true
  );

  update public.roster_invites
  set claimed_user_id = user_id
  where lower(trim(email)) = user_email
    and (claimed_user_id is null or claimed_user_id = user_id);

  select p.* into claimed_profile
  from public.profiles p
  where p.id = user_id;

  return claimed_profile;
end;
$$;

alter table public.profiles drop column role;
alter table public.roster_invites drop column role;
