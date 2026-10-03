-- Dynamic task audience for volunteers: "every volunteer of a season", or of
-- one group in that season.
--
-- A volunteer task used to be a fixed snapshot of whoever was on the roster
-- when it was created, so people imported afterwards never saw it. With
-- `audience_volunteers` set, every volunteer who has a `volunteer_seasons` row
-- for the task's cohort receives an assignment, both now and whenever such a
-- row is later created or changed (import, roster edit). With
-- `audience_group_id` also set, only that group's members match, plus the
-- leads when the group has `includes_leads` (the roster's own rule). It is a
-- plain uuid, not a foreign key: if the group is deleted nobody matches any
-- more, instead of the audience silently widening to the whole season. Due dates do not limit this, the
-- same as the mentor/mentee audiences in 0022.
--
-- Assignments are by volunteer record, so people without an account yet still
-- have the task waiting for them when they activate. Assignments are never
-- revoked: someone moved out of the season keeps what she was given.

alter table public.tasks
  add column if not exists audience_volunteers boolean not null default false;

alter table public.tasks
  drop constraint if exists tasks_volunteer_audience_has_cohort;
alter table public.tasks
  add constraint tasks_volunteer_audience_has_cohort check (
    not audience_volunteers or cohort_id is not null
  );

alter table public.tasks
  add column if not exists audience_group_id uuid;
alter table public.tasks
  drop constraint if exists tasks_volunteer_group_needs_audience;
alter table public.tasks
  add constraint tasks_volunteer_group_needs_audience check (
    audience_group_id is null or audience_volunteers
  );

create or replace function public.assign_volunteer_task_to_season_volunteers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.audience_volunteers then
    return new;
  end if;

  insert into public.task_assignments (task_id, volunteer_id)
  select distinct new.id, vs.volunteer_id
  from public.volunteer_seasons vs
  left join public.volunteer_groups g on g.id = new.audience_group_id
  where vs.cohort_id = new.cohort_id
    and (
      new.audience_group_id is null
      or vs.group_id = new.audience_group_id
      or (coalesce(g.includes_leads, false) and vs.is_lead)
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_tasks_assign_volunteer_audience on public.tasks;
create trigger trg_tasks_assign_volunteer_audience
after insert on public.tasks
for each row execute function public.assign_volunteer_task_to_season_volunteers();

create or replace function public.assign_matching_volunteer_tasks_to_volunteer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_assignments (task_id, volunteer_id)
  select t.id, new.volunteer_id
  from public.tasks t
  left join public.volunteer_groups g on g.id = t.audience_group_id
  where t.audience_volunteers
    and t.cohort_id = new.cohort_id
    and (
      t.audience_group_id is null
      or new.group_id = t.audience_group_id
      or (coalesce(g.includes_leads, false) and new.is_lead)
    )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_volunteer_seasons_assign_tasks on public.volunteer_seasons;
create trigger trg_volunteer_seasons_assign_tasks
after insert or update of cohort_id, volunteer_id, group_id, is_lead on public.volunteer_seasons
for each row execute function public.assign_matching_volunteer_tasks_to_volunteer();

-- One-off, run by hand after this migration if an existing season-wide task
-- should start covering later arrivals (for a group task also set
-- audience_group_id, and restrict the insert to that group) (this also hands it to everyone already
-- on the season's roster who is missing it):
--
--   update public.tasks set audience_volunteers = true where id = '<task id>';
--   insert into public.task_assignments (task_id, volunteer_id)
--   select distinct t.id, vs.volunteer_id
--   from public.tasks t
--   join public.volunteer_seasons vs on vs.cohort_id = t.cohort_id
--   where t.id = '<task id>'
--   on conflict do nothing;
