-- Editing a published task, with in-app "new" / "updated" reminders.
--
-- Two timestamps on each assignment express a reminder:
--   notified_at  last time this person was (re-)alerted to the task
--   seen_at      last time she opened 我的任务
-- seen_at is null         -> 新任务
-- seen_at < notified_at   -> 已更新
--
-- A freshly inserted assignment defaults to notified_at = now() and
-- seen_at = null, so "only notify the newly added people" needs no extra code.
-- Existing assignments light up again only when notified_at is bumped on
-- purpose (see admin_update_task). completed_at is never touched by an edit.

alter table public.tasks
  add column if not exists updated_at timestamptz not null default now();

alter table public.task_assignments
  add column if not exists notified_at timestamptz not null default now(),
  add column if not exists seen_at timestamptz;

-- Nobody should see 新任务 for work they already had before this migration.
update public.task_assignments
   set seen_at = now()
 where seen_at is null;

-- ---------------------------------------------------------------------------
-- Dynamic audiences: widening an audience on an existing task assigns the
-- newly matching people. Same functions as the INSERT triggers (0022, 0024);
-- they use `on conflict do nothing`, so existing assignments are untouched.
-- Assignments are still never revoked.
-- ---------------------------------------------------------------------------
drop trigger if exists trg_tasks_reassign_dynamic_audience on public.tasks;
create trigger trg_tasks_reassign_dynamic_audience
after update of audience_roles, cohort_id on public.tasks
for each row execute function public.assign_dynamic_task_to_matching_profiles();

drop trigger if exists trg_tasks_reassign_volunteer_audience on public.tasks;
create trigger trg_tasks_reassign_volunteer_audience
after update of audience_volunteers, audience_group_id, cohort_id on public.tasks
for each row execute function public.assign_volunteer_task_to_season_volunteers();

-- ---------------------------------------------------------------------------
-- Admin edit, in one transaction.
--
--   * content (title / description / link / due_on) changed
--       -> everyone who has not completed the task is re-alerted
--   * p_notify_all
--       -> everyone is re-alerted, completed people included
--         (they stay completed; they just see 已更新 again)
--   * neither -> only people added by this edit are alerted
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_task(
  p_id uuid,
  p_title text,
  p_description text,
  p_link text,
  p_due_on date,
  p_cohort_id uuid,
  p_audience_roles public.participant_role[],
  p_audience_volunteers boolean,
  p_audience_group_id uuid,
  p_added_volunteer_ids uuid[],
  p_added_profile_ids uuid[],
  p_notify_all boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.tasks%rowtype;
  v_content_changed boolean;
begin
  select * into v_old from public.tasks where id = p_id for update;
  if not found then
    raise exception 'TASK_NOT_FOUND';
  end if;

  v_content_changed :=
    v_old.title is distinct from p_title
    or v_old.description is distinct from p_description
    or v_old.link is distinct from p_link
    or v_old.due_on is distinct from p_due_on;

  update public.tasks
     set title = p_title,
         description = p_description,
         link = p_link,
         due_on = p_due_on,
         cohort_id = p_cohort_id,
         audience_roles = p_audience_roles,
         audience_volunteers = p_audience_volunteers,
         audience_group_id = p_audience_group_id,
         updated_at = case when v_content_changed then now() else updated_at end
   where id = p_id;
  -- The UPDATE triggers above assign any newly matching dynamic recipients.

  if coalesce(cardinality(p_added_volunteer_ids), 0) > 0 then
    insert into public.task_assignments (task_id, volunteer_id)
    select p_id, v.id
      from unnest(p_added_volunteer_ids) as v(id)
    on conflict do nothing;
  end if;

  if coalesce(cardinality(p_added_profile_ids), 0) > 0 then
    insert into public.task_assignments (task_id, profile_id)
    select p_id, p.id
      from unnest(p_added_profile_ids) as p(id)
    on conflict do nothing;
  end if;

  if v_content_changed or p_notify_all then
    update public.task_assignments
       set notified_at = now()
     where task_id = p_id
       and (p_notify_all or completed_at is null);
  end if;
end;
$$;

revoke all on function public.admin_update_task(
  uuid, text, text, text, date, uuid, public.participant_role[], boolean, uuid,
  uuid[], uuid[], boolean
) from public, anon, authenticated;
grant execute on function public.admin_update_task(
  uuid, text, text, text, date, uuid, public.participant_role[], boolean, uuid,
  uuid[], uuid[], boolean
) to service_role;

-- ---------------------------------------------------------------------------
-- A member has opened 我的任务.
-- ---------------------------------------------------------------------------
create or replace function public.mark_my_tasks_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.task_assignments a
     set seen_at = now()
   where public.is_my_assignment(a)
     and (a.seen_at is null or a.seen_at < a.notified_at);
$$;

revoke all on function public.mark_my_tasks_seen() from public;
grant execute on function public.mark_my_tasks_seen() to authenticated;
