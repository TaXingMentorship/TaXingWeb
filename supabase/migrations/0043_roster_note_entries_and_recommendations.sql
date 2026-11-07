-- 0043: internal roster notes become a thread of authored entries, and season
-- staff can recommend mentors for future seasons.
--
-- Requires 0042 (roster_notes, can_manage_roster_member). Additive only:
-- roster_notes is left in place (read-only history); nothing is deleted.
-- Access boundary is the same as 0042: admins, or volunteers linked to the
-- chosen season (is_season_volunteer). Clients have no direct table access;
-- every read/write goes through the security-definer RPCs below.

begin;

-- --- Note entries ----------------------------------------------------------

-- Member-level like roster_notes (shared across seasons), one row per entry.
create table public.roster_note_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- null for notes carried over from roster_notes with no recorded editor.
  author_id uuid references public.profiles(id) on delete set null,
  body text not null check (btrim(body) <> ''),
  created_at timestamptz not null default now()
);
create index roster_note_entries_profile_idx
  on public.roster_note_entries (profile_id, created_at);

alter table public.roster_note_entries enable row level security;
revoke all on public.roster_note_entries from anon, authenticated;

-- Each existing note becomes the first entry, attributed to its last editor.
insert into public.roster_note_entries (profile_id, author_id, body, created_at)
  select n.profile_id, n.updated_by, n.notes, n.updated_at
  from public.roster_notes n
  where n.notes is not null and btrim(n.notes) <> '';

create function public.assert_roster_staff(p_cohort_id uuid)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.is_admin() or public.is_season_volunteer(p_cohort_id)
  ) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
end;
$$;

create function public.list_roster_note_entries(p_cohort_id uuid)
returns table (
  id uuid,
  profile_id uuid,
  author_id uuid,
  author_name text,
  body text,
  created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_roster_staff(p_cohort_id);
  return query
    select e.id, e.profile_id, e.author_id, a.full_name, e.body, e.created_at
    from public.roster_note_entries e
    join public.profiles p on p.id = e.profile_id
    left join public.profiles a on a.id = e.author_id
    where p_cohort_id = any(p.cohort_ids)
    order by e.created_at, e.id;
end;
$$;

create function public.add_roster_note_entry(
  p_cohort_id uuid, p_profile_id uuid, p_body text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  perform public.assert_roster_staff(p_cohort_id);
  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p_cohort_id = any(p.cohort_ids)
  ) then
    raise exception 'ROSTER_MEMBER_NOT_IN_COHORT';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'ROSTER_NOTE_EMPTY';
  end if;
  if char_length(p_body) > 2000 then
    raise exception 'ROSTER_NOTE_TOO_LONG';
  end if;
  insert into public.roster_note_entries (profile_id, author_id, body)
    values (p_profile_id, auth.uid(), btrim(p_body))
    returning id into new_id;
  return new_id;
end;
$$;

-- Authors delete their own entries (while they still have access to the
-- member); admins may delete any entry.
create function public.delete_roster_note_entry(p_entry_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  entry public.roster_note_entries;
begin
  select * into entry from public.roster_note_entries where id = p_entry_id;
  if not found then
    return;
  end if;
  if auth.uid() is null or not (
    public.is_admin()
    or (entry.author_id = auth.uid() and public.can_manage_roster_member(entry.profile_id))
  ) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
  delete from public.roster_note_entries where id = p_entry_id;
end;
$$;

-- --- Mentor recommendations ------------------------------------------------

-- One recommendation per recommender, per mentor, per season.
create table public.mentor_recommendations (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.profiles(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete cascade,
  recommender_id uuid not null references public.profiles(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mentor_id, cohort_id, recommender_id)
);
create index mentor_recommendations_mentor_idx
  on public.mentor_recommendations (mentor_id);

alter table public.mentor_recommendations enable row level security;
revoke all on public.mentor_recommendations from anon, authenticated;

-- Every recommendation (all seasons) of the mentors in the chosen season, so
-- next season's staff can see a mentor's history.
create function public.list_mentor_recommendations(p_cohort_id uuid)
returns table (
  id uuid,
  mentor_id uuid,
  cohort_id uuid,
  cohort_name text,
  recommender_id uuid,
  recommender_name text,
  reason text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.assert_roster_staff(p_cohort_id);
  return query
    select r.id, r.mentor_id, r.cohort_id, c.name, r.recommender_id,
      u.full_name, r.reason, r.created_at, r.updated_at
    from public.mentor_recommendations r
    join public.profiles m on m.id = r.mentor_id
    join public.cohorts c on c.id = r.cohort_id
    left join public.profiles u on u.id = r.recommender_id
    where p_cohort_id = any(m.cohort_ids)
    order by c.starts_at desc nulls last, r.created_at;
end;
$$;

-- Recommend (or update the reason of) a mentor in a season the caller staffs.
create function public.set_mentor_recommendation(
  p_cohort_id uuid, p_mentor_id uuid, p_reason text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  saved_id uuid;
begin
  perform public.assert_roster_staff(p_cohort_id);
  if not exists (
    select 1 from public.profiles p
    where p.id = p_mentor_id
      and p_cohort_id = any(p.cohort_ids)
      and p.participant_role = 'mentor'
  ) then
    raise exception 'RECOMMEND_NOT_A_MENTOR_IN_COHORT';
  end if;
  if char_length(coalesce(p_reason, '')) > 500 then
    raise exception 'RECOMMEND_REASON_TOO_LONG';
  end if;
  insert into public.mentor_recommendations (mentor_id, cohort_id, recommender_id, reason)
    values (p_mentor_id, p_cohort_id, auth.uid(), nullif(btrim(p_reason), ''))
  on conflict (mentor_id, cohort_id, recommender_id) do update
    set reason = excluded.reason, updated_at = now()
  returning id into saved_id;
  return saved_id;
end;
$$;

-- Withdraw the caller's own recommendation for that season.
create function public.remove_mentor_recommendation(p_cohort_id uuid, p_mentor_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.assert_roster_staff(p_cohort_id);
  delete from public.mentor_recommendations
    where mentor_id = p_mentor_id
      and cohort_id = p_cohort_id
      and recommender_id = auth.uid();
end;
$$;

revoke all on function public.assert_roster_staff(uuid) from public, anon;
revoke all on function public.list_roster_note_entries(uuid) from public, anon;
revoke all on function public.add_roster_note_entry(uuid, uuid, text) from public, anon;
revoke all on function public.delete_roster_note_entry(uuid) from public, anon;
revoke all on function public.list_mentor_recommendations(uuid) from public, anon;
revoke all on function public.set_mentor_recommendation(uuid, uuid, text) from public, anon;
revoke all on function public.remove_mentor_recommendation(uuid, uuid) from public, anon;
grant execute on function public.assert_roster_staff(uuid) to authenticated;
grant execute on function public.list_roster_note_entries(uuid) to authenticated;
grant execute on function public.add_roster_note_entry(uuid, uuid, text) to authenticated;
grant execute on function public.delete_roster_note_entry(uuid) to authenticated;
grant execute on function public.list_mentor_recommendations(uuid) to authenticated;
grant execute on function public.set_mentor_recommendation(uuid, uuid, text) to authenticated;
grant execute on function public.remove_mentor_recommendation(uuid, uuid) to authenticated;

commit;
