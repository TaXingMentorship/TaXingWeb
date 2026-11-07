begin;

-- Notes remain member-level (shared across seasons), but no longer travel with profiles.
create table public.roster_notes (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.roster_notes enable row level security;
revoke all on public.roster_notes from anon, authenticated;
grant select on public.roster_notes to authenticated;

create function public.can_manage_roster_member(p_profile_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (
      select 1 from public.profiles p,
        lateral unnest(p.cohort_ids) as season(id)
      where p.id = p_profile_id and public.is_season_volunteer(season.id)
    )
  );
$$;
revoke all on function public.can_manage_roster_member(uuid) from public, anon;
grant execute on function public.can_manage_roster_member(uuid) to authenticated;

create policy roster_notes_staff_read on public.roster_notes
  for select to authenticated
  using (public.can_manage_roster_member(profile_id));

-- Copy first, then clear only values successfully preserved, in the same transaction.
insert into public.roster_notes(profile_id, notes)
  select id, admin_notes from public.profiles where admin_notes is not null;

update public.profiles p set admin_notes = null
where p.admin_notes is not null
  and exists (
    select 1 from public.roster_notes n
    where n.profile_id = p.id and n.notes = p.admin_notes
  );

create function public.reject_profile_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.admin_notes is not null then
    raise exception 'USE_PRIVATE_ROSTER_NOTES';
  end if;
  return new;
end;
$$;
create trigger profiles_private_notes_only
  before insert or update on public.profiles
  for each row execute function public.reject_profile_notes();

create function public.list_roster_cohorts()
returns setof public.cohorts
language sql stable security definer
set search_path = ''
as $$
  select c.* from public.cohorts c
  where auth.uid() is not null
    and (public.is_admin() or public.is_season_volunteer(c.id))
  order by c.starts_at desc nulls last, c.created_at desc;
$$;

create function public.list_staff_roster(p_cohort_id uuid)
returns setof public.profiles
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.is_admin() or public.is_season_volunteer(p_cohort_id)
  ) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
  return query select p.* from public.profiles p
    where p_cohort_id = any(p.cohort_ids)
    order by p.full_name, p.id;
end;
$$;

create function public.list_roster_notes(p_cohort_id uuid)
returns setof public.roster_notes
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not (
    public.is_admin() or public.is_season_volunteer(p_cohort_id)
  ) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
  return query select n.* from public.roster_notes n
    join public.profiles p on p.id = n.profile_id
    where p_cohort_id = any(p.cohort_ids);
end;
$$;

create function public.set_roster_note(p_cohort_id uuid, p_profile_id uuid, p_notes text)
returns public.roster_notes
language plpgsql security definer
set search_path = ''
as $$
declare
  saved public.roster_notes;
begin
  if auth.uid() is null or not (
    public.is_admin() or public.is_season_volunteer(p_cohort_id)
  ) then
    raise exception 'ROSTER_FORBIDDEN';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p_cohort_id = any(p.cohort_ids)
  ) then
    raise exception 'ROSTER_MEMBER_NOT_IN_COHORT';
  end if;
  insert into public.roster_notes(profile_id, notes, updated_by)
    values (p_profile_id, nullif(btrim(p_notes), ''), auth.uid())
  on conflict (profile_id) do update
    set notes = excluded.notes, updated_by = excluded.updated_by, updated_at = now()
  returning * into saved;
  return saved;
end;
$$;

revoke all on function public.list_roster_cohorts() from public, anon;
revoke all on function public.list_staff_roster(uuid) from public, anon;
revoke all on function public.list_roster_notes(uuid) from public, anon;
revoke all on function public.set_roster_note(uuid, uuid, text) from public, anon;
grant execute on function public.list_roster_cohorts() to authenticated;
grant execute on function public.list_staff_roster(uuid) to authenticated;
grant execute on function public.list_roster_notes(uuid) to authenticated;
grant execute on function public.set_roster_note(uuid, uuid, text) to authenticated;

commit;
