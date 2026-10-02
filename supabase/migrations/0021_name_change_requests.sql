-- Nicknames are fixed to the imported roster name; changing one needs an admin.
--
-- `profiles.full_name` (shown as 「昵称」) used to be freely editable, both when
-- claiming an invite and from 我的资料. Now:
--
--   * claiming an invite takes the name from the roster import, not from the
--     form;
--   * a non-admin cannot change `full_name` — the guard is the existing
--     privileged-fields trigger, so it holds for any client, not just ours;
--   * a member asks for a change with a required reason, and an admin approves
--     or rejects it (a rejection needs a note). Approval updates the name in
--     the same transaction.
--
-- Admins are exempt and keep editing names directly. Existing accounts are left
-- exactly as they are: whatever name a profile holds today is its starting
-- point, and nothing here rewrites it.
--
-- Every write goes through a function. There is deliberately no INSERT, UPDATE
-- or DELETE policy: "only these columns, only in this state" is not something
-- RLS can express, and a function can.

-- ---------------------------------------------------------------------------
-- 1. Lock the name
-- ---------------------------------------------------------------------------
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.id is distinct from old.id
       or new.participant_role is distinct from old.participant_role
       or new.is_admin is distinct from old.is_admin
       or new.is_volunteer is distinct from old.is_volunteer
       or new.cohort_ids is distinct from old.cohort_ids
       or new.email is distinct from old.email
       or new.admin_notes is distinct from old.admin_notes then
      raise exception 'PROFILE_PRIVILEGED_FIELDS';
    end if;

    -- A profile with no name yet may still be given one; after that it is
    -- locked.
    if old.full_name is not null
       and btrim(old.full_name) <> ''
       and new.full_name is distinct from old.full_name then
      raise exception 'PROFILE_NAME_LOCKED';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Claiming an invite uses the imported name
--
-- Same function as 0004 with one change: the name comes from the invite (the
-- earliest one, matching what the onboarding page shows). `p_full_name` is kept
-- so the signature and existing callers don't change, and is used only as a
-- fallback when the import left the name blank.
-- ---------------------------------------------------------------------------
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
  invite_name text;
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
    (array_agg(nullif(btrim(ri.full_name), '') order by ri.invited_at, ri.id)
       filter (where nullif(btrim(ri.full_name), '') is not null))[1],
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
    invite_name,
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

  invite_name := coalesce(invite_name, nullif(btrim(p_full_name), ''));
  if invite_name is null or length(invite_name) > 200 then
    raise exception 'INVALID_PROFILE';
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
    invite_name,
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

-- ---------------------------------------------------------------------------
-- 3. Requests
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.name_change_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.name_change_requests (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  old_name          text not null,
  requested_name    text not null
    check (char_length(btrim(requested_name)) between 1 and 200),
  reason            text not null
    check (char_length(btrim(reason)) between 1 and 500),
  status            public.name_change_status not null default 'pending',
  reviewed_by       uuid references public.profiles(id) on delete set null,
  reviewed_at       timestamptz,
  review_note       text,
  -- Set once the requester has seen the decision; drives the nav dot.
  requester_seen_at timestamptz,
  created_at        timestamptz not null default now(),
  check (
    status <> 'rejected'
    or char_length(btrim(coalesce(review_note, ''))) > 0
  )
);

-- One open request per person.
create unique index if not exists name_change_requests_one_pending
  on public.name_change_requests (profile_id)
  where status = 'pending';

create index if not exists name_change_requests_status_idx
  on public.name_change_requests (status, created_at desc);

alter table public.name_change_requests enable row level security;

drop policy if exists name_change_requests_select on public.name_change_requests;
create policy name_change_requests_select on public.name_change_requests
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

revoke all on public.name_change_requests from anon, authenticated;
grant select on public.name_change_requests to authenticated;

-- A member asks for a new nickname.
create or replace function public.request_name_change(
  p_requested_name text,
  p_reason         text
)
returns public.name_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_name    text := btrim(coalesce(p_requested_name, ''));
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_request public.name_change_requests;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if v_name = '' or length(v_name) > 200 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;
  if v_reason = '' or length(v_reason) > 500 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if v_name = btrim(coalesce(v_profile.full_name, '')) then
    raise exception 'NAME_UNCHANGED' using errcode = '22023';
  end if;

  begin
    insert into public.name_change_requests
      (profile_id, old_name, requested_name, reason)
    values
      (v_profile.id, coalesce(v_profile.full_name, ''), v_name, v_reason)
    returning * into v_request;
  exception when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING' using errcode = '23505';
  end;

  return v_request;
end;
$$;

-- A member withdraws their own open request.
create or replace function public.withdraw_name_change()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.name_change_requests
   where profile_id = auth.uid() and status = 'pending';
$$;

-- A member has seen the decisions on their requests.
create or replace function public.mark_name_changes_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.name_change_requests
     set requester_seen_at = now()
   where profile_id = auth.uid()
     and status <> 'pending'
     and requester_seen_at is null;
$$;

-- An admin decides. Approval changes the name in the same transaction.
create or replace function public.review_name_change(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns public.name_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.name_change_requests;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  select * into v_request
    from public.name_change_requests
   where id = p_request_id
   for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED' using errcode = '55000';
  end if;

  if not p_approve and v_note is null then
    raise exception 'REJECTION_NOTE_REQUIRED' using errcode = '22023';
  end if;

  if p_approve then
    update public.profiles
       set full_name = v_request.requested_name
     where id = v_request.profile_id;
  end if;

  update public.name_change_requests
     set status      = case when p_approve then 'approved'::public.name_change_status
                                            else 'rejected'::public.name_change_status end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = v_note
   where id = p_request_id
   returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_name_change(text, text) from public;
revoke all on function public.withdraw_name_change() from public;
revoke all on function public.mark_name_changes_seen() from public;
revoke all on function public.review_name_change(uuid, boolean, text) from public;
grant execute on function public.request_name_change(text, text) to authenticated;
grant execute on function public.withdraw_name_change() to authenticated;
grant execute on function public.mark_name_changes_seen() to authenticated;
grant execute on function public.review_name_change(uuid, boolean, text) to authenticated;
