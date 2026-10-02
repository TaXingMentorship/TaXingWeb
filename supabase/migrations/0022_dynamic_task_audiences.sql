-- Dynamic task audiences for mentors and mentees.
--
-- An empty `audience_roles` keeps the existing fixed-recipient behavior.
-- Otherwise every profile in the task's cohort whose participant role is in
-- the array receives an assignment, both now and when the profile is created
-- or later gains the matching role/cohort. Due dates intentionally do not
-- affect eligibility: newly joined members also receive overdue tasks.

alter table public.tasks
  add column if not exists audience_roles public.participant_role[]
    not null default '{}';

alter table public.tasks
  drop constraint if exists tasks_dynamic_audience_has_cohort;
alter table public.tasks
  add constraint tasks_dynamic_audience_has_cohort check (
    cardinality(audience_roles) = 0 or cohort_id is not null
  );

create or replace function public.assign_dynamic_task_to_matching_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if cardinality(new.audience_roles) = 0 then
    return new;
  end if;

  insert into public.task_assignments (task_id, profile_id)
  select new.id, p.id
  from public.profiles p
  where p.participant_role = any(new.audience_roles)
    and new.cohort_id = any(p.cohort_ids)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_tasks_assign_dynamic_audience on public.tasks;
create trigger trg_tasks_assign_dynamic_audience
after insert on public.tasks
for each row execute function public.assign_dynamic_task_to_matching_profiles();

create or replace function public.assign_matching_dynamic_tasks_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.participant_role is null then
    return new;
  end if;

  insert into public.task_assignments (task_id, profile_id)
  select t.id, new.id
  from public.tasks t
  where new.participant_role = any(t.audience_roles)
    and t.cohort_id = any(new.cohort_ids)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists trg_profiles_assign_dynamic_tasks on public.profiles;
create trigger trg_profiles_assign_dynamic_tasks
after insert or update of participant_role, cohort_ids on public.profiles
for each row execute function public.assign_matching_dynamic_tasks_to_profile();

-- The creation triggers cover normal writes. This authenticated catch-up also
-- closes the narrow concurrency gap where a profile and a matching task are
-- committed at the same instant and neither transaction can see the other yet.
create or replace function public.sync_my_dynamic_task_assignments()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_assignments (task_id, profile_id)
  select t.id, p.id
  from public.profiles p
  join public.tasks t
    on p.participant_role = any(t.audience_roles)
   and t.cohort_id = any(p.cohort_ids)
  where p.id = auth.uid()
  on conflict do nothing;
end;
$$;

revoke all on function public.sync_my_dynamic_task_assignments() from public;
grant execute on function public.sync_my_dynamic_task_assignments() to authenticated;
