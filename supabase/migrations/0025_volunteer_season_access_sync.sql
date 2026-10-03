-- A volunteer's seasons must reach their portal account, not just the roster.
--
-- `volunteer_seasons` (0010) says which seasons a volunteer took part in, but
-- 成员名单 and the member directory read `profiles.cohort_ids`, and that array
-- is written exactly once — by `claim_roster_invite` (0004), from whatever
-- `roster_invites` rows existed at the moment of first login. Seasons added to
-- the volunteer roster afterwards (a later import, a hand edit) never reached
-- the account: an active volunteer with ten seasons on the roster showed up in
-- 成员名单 for only the one season they were invited to. People who had not
-- activated yet had the same hole — an invite per season is what carries the
-- seasons into the account at activation, and no code created them.
--
-- 0018 closed the matching gap for invites (a new invite claims itself when the
-- account already exists). This closes the other one: every `volunteer_seasons`
-- row now guarantees a `roster_invites` row for that season, and, when the
-- volunteer already has an account, a matching entry in `profiles.cohort_ids`.
--
-- Additive only. Removing a season from the roster does NOT remove it from the
-- account: membership grants access (bulletin posting), and quietly revoking it
-- is not something a roster edit should do. Matching is by email, as in 0012
-- and 0018; a volunteer with no email and no account has nowhere to carry a
-- season and is skipped.

-- ---------------------------------------------------------------------------
-- 1. The sync
-- ---------------------------------------------------------------------------
create or replace function public.sync_volunteer_access(
  p_volunteer_id uuid,
  p_cohort_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v          public.volunteers;
  prof       public.profiles;
  v_email    text;
  v_cohorts  uuid[];
  i_role     public.participant_role;
  i_admin    boolean;
  i_volunteer boolean;
begin
  select * into v from public.volunteers where id = p_volunteer_id;
  if not found then
    return;
  end if;

  if v.profile_id is not null then
    select * into prof from public.profiles where id = v.profile_id;
  end if;

  -- The signed-in address is what an invite is matched on, so the account's
  -- email wins over the roster's when both exist.
  v_email := nullif(lower(btrim(coalesce(prof.email, v.email, ''))), '');
  if v_email is null then
    return;
  end if;

  select array_agg(vs.cohort_id)
    into v_cohorts
    from public.volunteer_seasons vs
   where vs.volunteer_id = v.id
     and (p_cohort_id is null or vs.cohort_id = p_cohort_id);
  if v_cohorts is null then
    return;
  end if;

  -- `claim_roster_invite` refuses an email whose unclaimed invites disagree on
  -- identity (INVITE_ROLE_CONFLICT), so a new invite copies the identity of one
  -- already there. With an account, the account's own identity is the answer.
  -- With neither, the person is a volunteer and nothing else.
  if prof.id is not null then
    i_role := prof.participant_role;
    i_admin := prof.is_admin;
    i_volunteer := prof.is_volunteer;
  else
    select ri.participant_role, ri.is_admin, ri.is_volunteer
      into i_role, i_admin, i_volunteer
      from public.roster_invites ri
     where lower(btrim(ri.email)) = v_email
       and ri.claimed_user_id is null
     order by ri.invited_at
     limit 1;
  end if;
  if i_role is null and not coalesce(i_admin, false) and not coalesce(i_volunteer, false) then
    i_volunteer := true;
  end if;

  -- With an account the 0018 trigger claims each new row on insert.
  insert into public.roster_invites
    (cohort_id, email, full_name, participant_role, is_admin, is_volunteer)
  select c, v_email, coalesce(nullif(btrim(prof.full_name), ''), v.full_name),
         i_role, coalesce(i_admin, false), coalesce(i_volunteer, false)
    from unnest(v_cohorts) c
   where not exists (
     select 1 from public.roster_invites ri
      where ri.cohort_id = c and lower(btrim(ri.email)) = v_email
   )
  on conflict (cohort_id, email) do nothing;

  -- Skipped when a non-admin is the one acting: that is a volunteer finishing
  -- onboarding (the account-link trigger lands here), where the invites above
  -- already carry every season, and `protect_profile_privileges` would reject
  -- a non-admin touching cohort_ids.
  if prof.id is not null
     and not (v_cohorts <@ prof.cohort_ids)
     and (auth.uid() is null or public.is_admin()) then
    update public.profiles p
       set cohort_ids = array(
         select distinct x from unnest(p.cohort_ids || v_cohorts) x
       )
     where p.id = prof.id;
  end if;
end;
$$;

revoke all on function public.sync_volunteer_access(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Triggers
-- ---------------------------------------------------------------------------
-- A season is added to a volunteer.
create or replace function public.trg_sync_access_on_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_volunteer_access(new.volunteer_id, new.cohort_id);
  return new;
end;
$$;

drop trigger if exists trg_volunteer_seasons_sync_access on public.volunteer_seasons;
create trigger trg_volunteer_seasons_sync_access
  after insert on public.volunteer_seasons
  for each row execute function public.trg_sync_access_on_season();

-- A volunteer gains an email or an account link after their seasons were
-- recorded — every season they already have is carried over at that point.
create or replace function public.trg_sync_access_on_volunteer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_volunteer_access(new.id);
  return new;
end;
$$;

drop trigger if exists trg_volunteers_sync_access on public.volunteers;
create trigger trg_volunteers_sync_access
  after insert or update of email, profile_id on public.volunteers
  for each row execute function public.trg_sync_access_on_volunteer();

revoke all on function public.trg_sync_access_on_season() from public, anon, authenticated;
revoke all on function public.trg_sync_access_on_volunteer() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Backfill whoever is already out of step
--
-- Idempotent: a volunteer whose account and invites already cover every season
-- is left untouched.
-- ---------------------------------------------------------------------------
select public.sync_volunteer_access(v.id) from public.volunteers v;
