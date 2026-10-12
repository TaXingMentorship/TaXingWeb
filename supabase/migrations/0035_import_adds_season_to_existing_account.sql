-- Importing someone who already has an account into a new season must put
-- that season on the account.
--
-- 0018 made a new invite claim itself when the email already has an account,
-- but only set `claimed_user_id`. It never touched `profiles.cohort_ids`, which
-- is what 成员名单, the member directory and the bulletin policies read (0001),
-- and which was written exactly once, by `claim_roster_invite` at first login
-- (0004). So a returning mentor or mentee re-imported into a new season held a
-- claimed invite for it, yet the season was not on their account: absent from
-- that season's roster and unable to post on its board, with nothing showing
-- why. Volunteers did not have the problem (0025 syncs their seasons).
--
-- The fix mirrors 0025: when an invite is claimed by an existing account, add
-- the invite's season to that account. Additive only; a season is never taken
-- away by a roster edit. It is skipped when a non-admin is the one acting,
-- because `protect_profile_privileges` (0021) rejects a non-admin touching
-- `cohort_ids`; imports run server-side (no `auth.uid()`) or as an admin.
--
-- Not changed: an existing account keeps its single `participant_role`. A
-- mentee invited as a mentor next season is still a mentee on the account.

-- ---------------------------------------------------------------------------
-- 1. From now on
-- ---------------------------------------------------------------------------
create or replace function public.backfill_roster_invite_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.claimed_user_id is null then
    new.claimed_user_id := (
      select p.id from public.profiles p
       where lower(btrim(p.email)) = lower(btrim(new.email))
       limit 1
    );
  end if;

  if new.claimed_user_id is not null
     and (auth.uid() is null or public.is_admin()) then
    update public.profiles p
       set cohort_ids = array(
         select distinct x from unnest(p.cohort_ids || new.cohort_id) x
       )
     where p.id = new.claimed_user_id
       and not (new.cohort_id = any (p.cohort_ids));
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Already stuck
--
-- Claimed invites whose account lacks the invite's season. Measured on the live
-- database when this was written: none, so this is a no-op there; it is here so
-- the rule holds for any rows that appear before this runs.
-- ---------------------------------------------------------------------------
update public.profiles p
   set cohort_ids = array(
     select distinct x from unnest(p.cohort_ids || missing.cohorts) x
   )
  from (
    select ri.claimed_user_id as profile_id, array_agg(distinct ri.cohort_id) as cohorts
      from public.roster_invites ri
      join public.profiles pr on pr.id = ri.claimed_user_id
     where not (ri.cohort_id = any (pr.cohort_ids))
     group by ri.claimed_user_id
  ) missing
 where p.id = missing.profile_id;
