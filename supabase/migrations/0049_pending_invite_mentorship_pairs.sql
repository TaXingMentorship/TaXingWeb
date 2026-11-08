-- Let explicit mentorship pairs and session logs refer to roster invite rows
-- until an invited mentor or mentee completes account setup.
alter table public.matches
  alter column mentor_id drop not null,
  alter column mentee_id drop not null,
  add column mentor_invite_id uuid references public.roster_invites (id),
  add column mentee_invite_id uuid references public.roster_invites (id),
  add constraint matches_mentor_identity check (
    (mentor_id is not null)::integer + (mentor_invite_id is not null)::integer = 1
  ),
  add constraint matches_mentee_identity check (
    (mentee_id is not null)::integer + (mentee_invite_id is not null)::integer = 1
  );

create unique index matches_profile_invite_pair_unique
  on public.matches (cohort_id, mentor_id, mentee_invite_id)
  where mentor_id is not null and mentee_invite_id is not null;
create unique index matches_invite_profile_pair_unique
  on public.matches (cohort_id, mentor_invite_id, mentee_id)
  where mentor_invite_id is not null and mentee_id is not null;
create unique index matches_invite_pair_unique
  on public.matches (cohort_id, mentor_invite_id, mentee_invite_id)
  where mentor_invite_id is not null and mentee_invite_id is not null;

alter table public.sessions_log
  alter column mentor_id drop not null,
  alter column mentee_id drop not null,
  add column mentor_invite_id uuid references public.roster_invites (id),
  add column mentee_invite_id uuid references public.roster_invites (id),
  add constraint sessions_mentor_identity check (
    (mentor_id is not null)::integer + (mentor_invite_id is not null)::integer = 1
  ),
  add constraint sessions_mentee_identity check (
    (mentee_id is not null)::integer + (mentee_invite_id is not null)::integer = 1
  );

create or replace function public.admin_import_matches(
  p_cohort_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  mentor uuid;
  mentee uuid;
  mentor_profile uuid;
  mentor_invite uuid;
  mentee_profile uuid;
  mentee_invite uuid;
  inserted_match public.matches;
  added_rows jsonb := '[]'::jsonb;
  skipped_rows jsonb := '[]'::jsonb;
  item_number integer := 0;
begin
  if not exists (select 1 from public.cohorts where id = p_cohort_id) then
    raise exception 'COHORT_NOT_FOUND';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'EMPTY_MATCHES';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    item_number := item_number + 1;
    begin
      mentor := (item ->> 'mentor_id')::uuid;
      mentee := (item ->> 'mentee_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'ROW_%_INVALID_ID', item_number;
    end;

    mentor_profile := null;
    mentor_invite := null;
    mentee_profile := null;
    mentee_invite := null;

    select p.id into mentor_profile
    from public.profiles p
    where p.id = mentor
      and p.participant_role = 'mentor'
      and p_cohort_id = any(p.cohort_ids);
    if mentor_profile is null then
      select ri.id into mentor_invite
      from public.roster_invites ri
      where ri.id = mentor
        and ri.cohort_id = p_cohort_id
        and ri.participant_role = 'mentor'
        and ri.claimed_user_id is null
        and not ri.not_participating
        and not exists (
          select 1 from public.profiles p
          where lower(trim(p.email)) = lower(trim(ri.email))
        );
    end if;
    if mentor_profile is null and mentor_invite is null then
      raise exception 'ROW_%_INVALID_MENTOR', item_number;
    end if;

    select p.id into mentee_profile
    from public.profiles p
    where p.id = mentee
      and p.participant_role = 'mentee'
      and p_cohort_id = any(p.cohort_ids);
    if mentee_profile is null then
      select ri.id into mentee_invite
      from public.roster_invites ri
      where ri.id = mentee
        and ri.cohort_id = p_cohort_id
        and ri.participant_role = 'mentee'
        and ri.claimed_user_id is null
        and not ri.not_participating
        and not exists (
          select 1 from public.profiles p
          where lower(trim(p.email)) = lower(trim(ri.email))
        );
    end if;
    if mentee_profile is null and mentee_invite is null then
      raise exception 'ROW_%_INVALID_MENTEE', item_number;
    end if;

    insert into public.matches (
      cohort_id, mentor_id, mentee_id, mentor_invite_id, mentee_invite_id
    )
    values (
      p_cohort_id, mentor_profile, mentee_profile, mentor_invite, mentee_invite
    )
    on conflict do nothing
    returning * into inserted_match;

    if inserted_match.id is null then
      skipped_rows := skipped_rows || jsonb_build_array(jsonb_build_object(
        'row', item,
        'reason', '该配对已存在或在文件中重复'
      ));
    else
      added_rows := added_rows || jsonb_build_array(to_jsonb(inserted_match));
    end if;
    inserted_match := null;
  end loop;

  return jsonb_build_object(
    'added', added_rows,
    'skipped', skipped_rows,
    'errors', '[]'::jsonb
  );
end;
$$;

create function public.list_session_roster_invites(p_cohort_id uuid)
returns table (
  id uuid,
  cohort_id uuid,
  full_name text,
  email text,
  participant_role public.participant_role
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.is_admin()
    or public.is_season_volunteer(p_cohort_id)
    or exists (
      select 1
      from public.matches m
      where m.cohort_id = p_cohort_id
        and (
          (m.mentor_id = auth.uid() and m.mentee_invite_id is not null)
          or (m.mentee_id = auth.uid() and m.mentor_invite_id is not null)
        )
    )
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
    select ri.id, ri.cohort_id, ri.full_name, ri.email, ri.participant_role
    from public.roster_invites ri
    where ri.cohort_id = p_cohort_id
      and ri.participant_role in ('mentor', 'mentee')
      and ri.claimed_user_id is null
      and not ri.not_participating
      and not exists (
        select 1 from public.profiles p
        where lower(trim(p.email)) = lower(trim(ri.email))
      )
      and (
        public.is_admin()
        or public.is_season_volunteer(p_cohort_id)
        or exists (
          select 1 from public.matches m
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
