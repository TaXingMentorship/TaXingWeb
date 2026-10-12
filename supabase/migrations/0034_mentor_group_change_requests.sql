-- Mentors can see their own answer group (0028 already lets any signed-in
-- member read `mentor_group_members`) but cannot change it: writes there are
-- admin-only. This adds the way to ask — a request naming the group they want
-- and why, decided by an admin. It is the same shape as the nickname requests
-- (0021): one open request at a time, a rejection must carry a note, and the
-- requester sees the decision once.
--
-- Approving moves the mentor in the same transaction, after checking they are
-- still a mentor of that season. A mentor holds one seat per season
-- (`unique (cohort_id, profile_id)`), so the move is an upsert.

do $$
begin
  create type public.mentor_group_change_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

create table if not exists public.mentor_group_change_requests (
  id                uuid primary key default gen_random_uuid(),
  cohort_id         uuid not null references public.cohorts (id) on delete cascade,
  profile_id        uuid not null references public.profiles (id) on delete cascade,
  -- Where the mentor was when they asked; null if they had no group yet.
  from_group_id     uuid references public.mentor_groups (id) on delete set null,
  to_group_id       uuid not null references public.mentor_groups (id) on delete cascade,
  reason            text not null
    check (char_length(btrim(reason)) between 1 and 500),
  status            public.mentor_group_change_status not null default 'pending',
  reviewed_by       uuid references public.profiles (id) on delete set null,
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

-- One open request per mentor per season.
create unique index if not exists mentor_group_change_requests_one_pending
  on public.mentor_group_change_requests (profile_id, cohort_id)
  where status = 'pending';

create index if not exists mentor_group_change_requests_status_idx
  on public.mentor_group_change_requests (status, created_at desc);

alter table public.mentor_group_change_requests enable row level security;

drop policy if exists mentor_group_change_requests_select on public.mentor_group_change_requests;
create policy mentor_group_change_requests_select on public.mentor_group_change_requests
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

-- Writes go through the functions below only.
revoke all on public.mentor_group_change_requests from anon, authenticated;
grant select on public.mentor_group_change_requests to authenticated;

-- A mentor asks to move to another group.
create or replace function public.request_mentor_group_change(
  p_cohort_id   uuid,
  p_to_group_id uuid,
  p_reason      text
)
returns public.mentor_group_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_current uuid;
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_request public.mentor_group_change_requests;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'UNAUTHENTICATED' using errcode = '42501';
  end if;

  if v_profile.participant_role is distinct from 'mentor'
     or not (p_cohort_id = any (v_profile.cohort_ids)) then
    raise exception 'NOT_A_MENTOR' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.mentor_groups g
     where g.id = p_to_group_id and g.cohort_id = p_cohort_id
  ) then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_reason = '' or length(v_reason) > 500 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;

  select m.group_id into v_current
    from public.mentor_group_members m
   where m.cohort_id = p_cohort_id and m.profile_id = v_profile.id;
  if v_current is not distinct from p_to_group_id then
    raise exception 'GROUP_UNCHANGED' using errcode = '22023';
  end if;

  begin
    insert into public.mentor_group_change_requests
      (cohort_id, profile_id, from_group_id, to_group_id, reason)
    values
      (p_cohort_id, v_profile.id, v_current, p_to_group_id, v_reason)
    returning * into v_request;
  exception when unique_violation then
    raise exception 'REQUEST_ALREADY_PENDING' using errcode = '23505';
  end;

  return v_request;
end;
$$;

-- A mentor withdraws their own open request for a season.
create or replace function public.withdraw_mentor_group_change(p_cohort_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.mentor_group_change_requests
   where profile_id = auth.uid()
     and cohort_id = p_cohort_id
     and status = 'pending';
$$;

-- A mentor has seen the decisions on their requests.
create or replace function public.mark_mentor_group_changes_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.mentor_group_change_requests
     set requester_seen_at = now()
   where profile_id = auth.uid()
     and status <> 'pending'
     and requester_seen_at is null;
$$;

-- An admin decides. Approval moves the mentor in the same transaction.
create or replace function public.review_mentor_group_change(
  p_request_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns public.mentor_group_change_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.mentor_group_change_requests;
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if not public.is_admin() then
    raise exception 'ADMIN_ONLY' using errcode = '42501';
  end if;

  select * into v_request
    from public.mentor_group_change_requests
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
    -- The request was valid when it was made; the person may have changed since
    -- (made a mentee, taken off the season). Approving would then seat a
    -- non-mentor in an answer group. A rejection needs no such check.
    if not exists (
      select 1 from public.profiles pr
       where pr.id = v_request.profile_id
         and pr.participant_role = 'mentor'
         and v_request.cohort_id = any (pr.cohort_ids)
    ) then
      raise exception 'REQUESTER_NOT_MENTOR' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.mentor_groups g
       where g.id = v_request.to_group_id and g.cohort_id = v_request.cohort_id
    ) then
      raise exception 'GROUP_NOT_FOUND' using errcode = 'P0002';
    end if;

    insert into public.mentor_group_members (cohort_id, group_id, profile_id)
    values (v_request.cohort_id, v_request.to_group_id, v_request.profile_id)
    on conflict (cohort_id, profile_id)
      do update set group_id = excluded.group_id;
  end if;

  update public.mentor_group_change_requests
     set status      = case when p_approve then 'approved'::public.mentor_group_change_status
                                            else 'rejected'::public.mentor_group_change_status end,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         review_note = v_note
   where id = p_request_id
   returning * into v_request;

  return v_request;
end;
$$;

revoke all on function public.request_mentor_group_change(uuid, uuid, text) from public;
revoke all on function public.withdraw_mentor_group_change(uuid) from public;
revoke all on function public.mark_mentor_group_changes_seen() from public;
revoke all on function public.review_mentor_group_change(uuid, boolean, text) from public;
grant execute on function public.request_mentor_group_change(uuid, uuid, text) to authenticated;
grant execute on function public.withdraw_mentor_group_change(uuid) to authenticated;
grant execute on function public.mark_mentor_group_changes_seen() to authenticated;
grant execute on function public.review_mentor_group_change(uuid, boolean, text) to authenticated;
