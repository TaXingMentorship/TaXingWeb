-- A roster_invites row created for someone who already has a portal account
-- must not stay stuck as "unactivated" forever.
--
-- `claim_roster_invite` (0004) only runs once per person: it raises
-- ALREADY_ONBOARDED and exits immediately if `profiles` already has a row for
-- them. When it does run, it claims every `roster_invites` row matching the
-- email that *already exists at that moment* — it has no way to reach rows
-- created afterwards.
--
-- `admin_import_members` (0014) inserts a fresh `roster_invites` row
-- (`claimed_user_id` left null) whenever a person is imported into a cohort
-- they don't already have an invite for — including someone who has been
-- onboarded for months. Nothing ever revisits that row, so 成员名单 shows them
-- as "未激活" even though they are a fully active member. This was found live:
-- a volunteer's two later-season invites stayed unclaimed despite her profile
-- and volunteer record both being long since linked.
--
-- The fix mirrors 0012's own pattern for volunteers<->profiles: a one-time
-- backfill for rows already stuck, plus a trigger so it can never happen
-- again. Matching is by email only, the same rule `claim_roster_invite`
-- itself uses — a name is not proof of identity, an email is the activation
-- mechanism.

-- ---------------------------------------------------------------------------
-- 1. Backfill invites that are already stuck
-- ---------------------------------------------------------------------------
update public.roster_invites ri
   set claimed_user_id = p.id
  from public.profiles p
 where ri.claimed_user_id is null
   and lower(btrim(ri.email)) = lower(btrim(p.email));

-- ---------------------------------------------------------------------------
-- 2. Keep it from happening again: claim on arrival if the account already
--    exists
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
  return new;
end;
$$;

drop trigger if exists trg_roster_invites_backfill_claim on public.roster_invites;
create trigger trg_roster_invites_backfill_claim
  before insert or update of email on public.roster_invites
  for each row execute function public.backfill_roster_invite_claim();
