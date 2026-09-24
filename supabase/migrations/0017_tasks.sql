-- Tasks: admin-assigned to-dos that surface as reminders inside the portal.
--
-- A task is one thing to do (title, description, optional link and due date);
-- `task_assignments` is who has to do it, one row per recipient. Recipients
-- are addressed by **volunteer record**, not by account: most volunteers have
-- no account yet, and a task assigned before they activate must still be
-- waiting for them afterwards. The assignee's account is resolved at read
-- time through `volunteers.profile_id`, the same link `volunteers_resolved`
-- uses. `profile_id` on the assignment is the direct form for people who are
-- not volunteers (mentors, mentees) — no UI uses it yet, but the shape
-- should not need a migration when one does.
--
-- Writes are split the usual way: admins create and delete through
-- /api/admin/tasks (service role, one transaction for task + recipients);
-- a recipient can only complete or reopen her own assignment, and only via
-- `set_my_task_done()` — an UPDATE policy cannot restrict which columns
-- change.

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  description text,
  -- A portal path such as /portal/me; the reminder links there.
  link        text,
  due_on      date,
  cohort_id   uuid references public.cohorts(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.task_assignments (
  id            uuid primary key default gen_random_uuid(),
  task_id       uuid not null references public.tasks(id) on delete cascade,
  volunteer_id  uuid references public.volunteers(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete cascade,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  check (volunteer_id is not null or profile_id is not null)
);

create unique index if not exists task_assignments_task_volunteer_key
  on public.task_assignments (task_id, volunteer_id) where volunteer_id is not null;
create unique index if not exists task_assignments_task_profile_key
  on public.task_assignments (task_id, profile_id) where profile_id is not null;
create index if not exists task_assignments_volunteer_idx
  on public.task_assignments (volunteer_id);
create index if not exists task_assignments_profile_idx
  on public.task_assignments (profile_id);

alter table public.tasks            enable row level security;
alter table public.task_assignments enable row level security;

-- An assignment is mine when it names my account, or the volunteer record
-- linked to my account (`my_volunteer_id()`, migration 0016).
create or replace function public.is_my_assignment(a public.task_assignments)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a.profile_id = auth.uid()
      or (a.volunteer_id is not null and a.volunteer_id = public.my_volunteer_id());
$$;

revoke all on function public.is_my_assignment(public.task_assignments) from public;
grant execute on function public.is_my_assignment(public.task_assignments) to authenticated;

drop policy if exists task_assignments_select on public.task_assignments;
create policy task_assignments_select on public.task_assignments
  for select using (public.is_admin() or public.is_my_assignment(task_assignments));

drop policy if exists task_assignments_admin_all on public.task_assignments;
create policy task_assignments_admin_all on public.task_assignments
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists tasks_select on public.tasks;
create policy tasks_select on public.tasks
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.task_assignments a
      where a.task_id = tasks.id and public.is_my_assignment(a)
    )
  );

drop policy if exists tasks_admin_all on public.tasks;
create policy tasks_admin_all on public.tasks
  for all using (public.is_admin()) with check (public.is_admin());

revoke all on public.tasks, public.task_assignments from anon;
grant select on public.tasks, public.task_assignments to authenticated;
grant insert, update, delete on public.tasks, public.task_assignments to authenticated;

-- Complete or reopen one of my own assignments. Nothing else on the row is
-- reachable from the client.
create or replace function public.set_my_task_done(
  p_assignment_id uuid,
  p_done boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.task_assignments%rowtype;
begin
  select * into v_assignment
    from public.task_assignments
   where id = p_assignment_id;

  if not found or not public.is_my_assignment(v_assignment) then
    raise exception 'NOT_YOUR_TASK' using errcode = '42501';
  end if;

  update public.task_assignments
     set completed_at = case when p_done then coalesce(completed_at, now()) else null end
   where id = p_assignment_id;
end;
$$;

revoke all on function public.set_my_task_done(uuid, boolean) from public;
grant execute on function public.set_my_task_done(uuid, boolean) to authenticated;
