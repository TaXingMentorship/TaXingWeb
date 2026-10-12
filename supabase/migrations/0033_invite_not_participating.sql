-- Admin-set flag: this invited person will not take part in the season.
--
-- "Invited but never activated" is ambiguous. Some of those people are simply
-- stuck on a network problem and still coming; others have told the organisers
-- they are out. Nothing in `roster_invites` could say which, so the pending
-- list could not be used to chase only the first group.
--
-- The flag is deliberately manual and per invite (one invite = one season). It
-- is not derived from `claimed_user_id`, and `admin_import_members` never
-- touches it, so re-importing a roster does not silently clear anyone's mark.
-- Admins already have full access through `roster_invites_admin_all`.

alter table public.roster_invites
  add column if not exists not_participating boolean not null default false;
