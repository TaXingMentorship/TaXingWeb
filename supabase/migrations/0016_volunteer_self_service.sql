-- Volunteers may change their own group for a season they already belong to.
--
-- Until now every write to `volunteer_seasons` was admin-only (0010). A
-- volunteer with a portal account can now move herself between groups from
-- 我的资料, and only that: adding or removing a season, and the `is_lead`
-- mark, stay with admins. The rule is enforced by exposing a single function
-- rather than an UPDATE policy — a policy would have to say "any column except
-- these", which Postgres RLS cannot express.
--
-- Every change is recorded in `volunteer_season_changes` so an admin can see
-- who moved where and when. The log is append-only and admin-readable; the
-- function is the only writer.

create table if not exists public.volunteer_season_changes (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references public.volunteers(id) on delete cascade,
  cohort_id     uuid not null references public.cohorts(id) on delete cascade,
  old_group_id  uuid references public.volunteer_groups(id) on delete set null,
  new_group_id  uuid references public.volunteer_groups(id) on delete set null,
  changed_by    uuid not null references public.profiles(id) on delete cascade,
  changed_at    timestamptz not null default now()
);

create index if not exists volunteer_season_changes_volunteer_idx
  on public.volunteer_season_changes (volunteer_id, changed_at desc);

alter table public.volunteer_season_changes enable row level security;

drop policy if exists volunteer_season_changes_admin_select on public.volunteer_season_changes;
create policy volunteer_season_changes_admin_select on public.volunteer_season_changes
  for select using (public.is_admin());

revoke all on public.volunteer_season_changes from anon;
grant select on public.volunteer_season_changes to authenticated;

-- The volunteer record linked to the signed-in account, if any. `profile_id`
-- is kept current by the email triggers in 0012, so this is the same link the
-- roster page shows.
create or replace function public.my_volunteer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select v.id from public.volunteers v where v.profile_id = auth.uid() limit 1;
$$;

revoke all on function public.my_volunteer_id() from public;
grant execute on function public.my_volunteer_id() to authenticated;

create or replace function public.set_my_volunteer_group(
  p_season_id uuid,
  p_group_id  uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season public.volunteer_seasons%rowtype;
begin
  select s.* into v_season
    from public.volunteer_seasons s
    join public.volunteers v on v.id = s.volunteer_id
   where s.id = p_season_id
     and v.profile_id = auth.uid();

  if not found then
    raise exception 'NOT_YOUR_SEASON' using errcode = '42501';
  end if;

  if p_group_id is not null
     and not exists (select 1 from public.volunteer_groups g where g.id = p_group_id) then
    raise exception 'UNKNOWN_GROUP' using errcode = '23503';
  end if;

  -- A lead leads a group; the import and the admin dialog reject the same
  -- combination.
  if v_season.is_lead and p_group_id is null then
    raise exception 'LEAD_WITHOUT_GROUP' using errcode = '23514';
  end if;

  if v_season.group_id is not distinct from p_group_id then
    return;
  end if;

  update public.volunteer_seasons
     set group_id = p_group_id
   where id = p_season_id;

  insert into public.volunteer_season_changes
    (volunteer_id, cohort_id, old_group_id, new_group_id, changed_by)
  values
    (v_season.volunteer_id, v_season.cohort_id, v_season.group_id, p_group_id, auth.uid());
end;
$$;

revoke all on function public.set_my_volunteer_group(uuid, uuid) from public;
grant execute on function public.set_my_volunteer_group(uuid, uuid) to authenticated;
