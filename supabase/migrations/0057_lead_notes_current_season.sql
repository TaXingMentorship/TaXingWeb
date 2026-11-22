-- 0057: lead notes follow the CURRENT season's leads (amends 0056).
--
-- 0056 let a lead see notes about volunteers who shared any season with them,
-- for ever. The rule is now: the leads of the current season, and admins, may
-- read and write notes about every volunteer of every season. Someone who led
-- 25秋 but not 26秋 is an ordinary volunteer again and sees nothing.
--
-- "Current season" is the newest cohort, in the order every season picker
-- uses (starts_at desc nulls last, created_at desc). Until a newer cohort is
-- created, the newest one's leads keep access; once it is created, access moves
-- to whoever is marked is_lead in it.
--
-- Leads may see notes written about themselves (agreed with the product side).
-- Blacklisted (0055) callers stay refused. Table and grants are unchanged.

begin;

-- The newest season, by the same order as listCohorts.
create function public.current_season_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select c.id
  from public.cohorts c
  order by c.starts_at desc nulls last, c.created_at desc
  limit 1;
$$;

-- Is the caller a lead of the current season? (Gate for the RPCs and the UI.)
create function public.is_current_season_lead()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
    and exists (
      select 1
      from public.volunteers v
      join public.volunteer_seasons vs on vs.volunteer_id = v.id
      where v.profile_id = auth.uid()
        and vs.is_lead
        and vs.cohort_id = public.current_season_id()
    );
$$;

-- May the caller read/write lead notes? Same answer for every volunteer now;
-- the parameter stays so the 0056 write RPCs keep calling it unchanged.
create or replace function public.can_lead_note_volunteer(p_volunteer_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
    and (public.is_admin() or public.is_current_season_lead());
$$;

-- Every note, for callers who pass the gate once (no per-row check).
create or replace function public.list_volunteer_lead_notes()
returns table (
  id uuid,
  volunteer_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.can_lead_note_volunteer(null) then
    raise exception 'LEAD_NOTES_FORBIDDEN';
  end if;
  return query
    select n.id, n.volunteer_id, n.author_id, a.full_name, n.body, n.created_at, n.edited_at
    from public.volunteer_lead_notes n
    left join public.profiles a on a.id = n.author_id
    order by n.created_at, n.id;
end;
$$;

-- 0056's season-sharing helper has no callers left.
drop function public.is_any_season_lead();

revoke all on function public.current_season_id() from public, anon;
revoke all on function public.is_current_season_lead() from public, anon;
grant execute on function public.current_season_id() to authenticated;
grant execute on function public.is_current_season_lead() to authenticated;

commit;
