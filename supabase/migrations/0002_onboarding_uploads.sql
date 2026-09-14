-- Secure roster claiming and production upload storage.

alter table public.participation_records
  add column if not exists screenshot_path text;

alter table public.profiles
  drop column if exists goals;

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
    'role', first_invite.role,
    'cohortIds', coalesce(
      array_agg(distinct ri.cohort_id) filter (where ri.role = first_invite.role),
      '{}'::uuid[]
    ),
    'cohortNames', coalesce(
      array_agg(distinct c.name) filter (where ri.role = first_invite.role),
      '{}'::text[]
    )
  )
  into result
  from public.roster_invites ri
  join public.cohorts c on c.id = ri.cohort_id
  cross join lateral (
    select candidate.full_name, candidate.role
    from public.roster_invites candidate
    where lower(trim(candidate.email)) = user_email
      and (candidate.claimed_user_id is null or candidate.claimed_user_id = auth.uid())
    order by candidate.invited_at, candidate.id
    limit 1
  ) first_invite
  where lower(trim(ri.email)) = user_email
    and (ri.claimed_user_id is null or ri.claimed_user_id = auth.uid())
  group by first_invite.full_name, first_invite.role;

  return result;
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
  invite_role public.user_role;
  invite_cohorts uuid[];
  role_count integer;
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
    min(ri.role::text)::public.user_role,
    array_agg(distinct ri.cohort_id),
    count(distinct ri.role)
  into invite_role, invite_cohorts, role_count
  from public.roster_invites ri
  where lower(trim(ri.email)) = user_email
    and (ri.claimed_user_id is null or ri.claimed_user_id = user_id);

  if invite_role is null or invite_cohorts is null then
    raise exception 'INVITE_NOT_FOUND';
  end if;

  if role_count <> 1 then
    raise exception 'INVITE_ROLE_CONFLICT';
  end if;

  insert into public.profiles (
    id,
    role,
    cohort_ids,
    full_name,
    email,
    wechat_number,
    avatar_url,
    visible
  )
  values (
    user_id,
    invite_role,
    invite_cohorts,
    trim(p_full_name),
    user_email,
    nullif(trim(p_wechat_number), ''),
    nullif(trim(p_avatar_url), ''),
    true
  )
  on conflict (id) do nothing;

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

revoke all on function public.get_onboarding_invite() from public;
revoke all on function public.claim_roster_invite(text, text, text) from public;
grant execute on function public.get_onboarding_invite() to authenticated;
grant execute on function public.claim_roster_invite(text, text, text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participation',
  'participation',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_select_allowed on storage.objects;
create policy participation_select_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'participation'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

drop policy if exists participation_insert_own on storage.objects;
create policy participation_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'participation'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_update_own on storage.objects;
create policy participation_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'participation'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'participation'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists participation_delete_own on storage.objects;
create policy participation_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'participation'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
