create or replace function public.list_session_roster_invites(p_cohort_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  full_name text,
  email text,
  participant_role public.participant_role,
  claimed_user_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Callers without invite-backed pairs get an empty result, not an error;
  -- the row filter below already limits what each caller can see.
  if auth.uid() is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select ri.id, ri.cohort_id, ri.full_name, ri.email,
           ri.participant_role, ri.claimed_user_id
    from public.roster_invites ri
    where ri.cohort_id = p_cohort_id
      and ri.participant_role in ('mentor', 'mentee')
      and not ri.not_participating
      and (
        (
          ri.claimed_user_id is null
          and not exists (
            select 1 from public.profiles p
            where lower(trim(p.email)) = lower(trim(ri.email))
          )
        )
        or exists (
          select 1
          from public.matches m
          where m.cohort_id = p_cohort_id
            and (
              m.mentor_invite_id = ri.id
              or m.mentee_invite_id = ri.id
            )
        )
      )
      and (
        public.is_admin()
        or public.is_season_volunteer(p_cohort_id)
        or exists (
          select 1
          from public.matches m
          where m.cohort_id = p_cohort_id
            and (
              (m.mentor_id = auth.uid() and m.mentee_invite_id = ri.id)
              or (m.mentee_id = auth.uid() and m.mentor_invite_id = ri.id)
            )
        )
      )
    order by ri.full_name, ri.id;
end;
$$;

revoke all on function public.list_session_roster_invites(uuid) from public, anon;
grant execute on function public.list_session_roster_invites(uuid) to authenticated;
