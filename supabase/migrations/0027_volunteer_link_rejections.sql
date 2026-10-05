-- "Not the same person" decisions for the 待确认的账号关联 list.
--
-- A volunteer and a portal account that share a name but not an email are
-- offered to an admin as a candidate link (see listLinkCandidates). Until now
-- the only choices were to confirm or to leave the row there forever, so a
-- genuine namesake kept coming back. A rejection records the decision for that
-- exact (volunteer, account) pair and hides it from the candidate list.
--
-- It is scoped to the pair, not the name: the same volunteer can still be
-- offered a different account later, and a rejection can be undone.
-- It does not touch the email-match triggers from 0012 — an identical email is
-- stronger evidence than a name and still links automatically.

create table if not exists public.volunteer_link_rejections (
  volunteer_id uuid not null references public.volunteers(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id)   on delete cascade,
  rejected_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (volunteer_id, profile_id)
);

alter table public.volunteer_link_rejections enable row level security;

-- Writes go through the admin API (service role); admins may read directly.
drop policy if exists volunteer_link_rejections_admin_select
  on public.volunteer_link_rejections;
create policy volunteer_link_rejections_admin_select
  on public.volunteer_link_rejections
  for select to authenticated using (public.is_admin());

revoke all on public.volunteer_link_rejections from anon;
grant select on public.volunteer_link_rejections to authenticated;
