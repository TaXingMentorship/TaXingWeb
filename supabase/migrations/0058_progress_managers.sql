-- 0058: progress managers may edit mentors' and mentees' progress records.
--
-- 进度跟踪 had two kinds of record and two narrow write paths: session logs
-- (sessions_log) were editable by admins and the mentor on the row, and mentee
-- activity records (participation_records) only by admins and the mentee.
-- Ordinary season volunteers could read session logs (0048) but not edit them,
-- and could not see activity records at all.
--
-- A "progress manager" for a season is now:
--   * an admin, or
--   * a lead of any working group in THAT season (volunteer_seasons.is_lead), or
--   * a member of 人事组 in THAT season.
-- Blacklisted (0055) callers are refused.
--
-- Session-log writes stay in /api/admin/sessions (service role), which calls
-- this function. Activity-record writes by managers go through
-- /api/admin/participation. This migration only widens READS: managers can
-- select the season's participation_records and their screenshots.

begin;

create function public.can_manage_season_progress(p_cohort_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and not exists (select 1 from public.member_blacklist b where b.profile_id = auth.uid())
    and (
      public.is_admin()
      or exists (
        select 1
        from public.volunteers v
        join public.volunteer_seasons vs on vs.volunteer_id = v.id
        left join public.volunteer_groups g on g.id = vs.group_id
        where v.profile_id = auth.uid()
          and vs.cohort_id = p_cohort_id
          and (vs.is_lead or g.name = '人事组')
      )
    );
$$;

-- Storage objects are keyed by path; resolve the path to its record's season.
create function public.can_manage_participation_object(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participation_records r
    where r.screenshot_path = p_name
      and public.can_manage_season_progress(r.cohort_id)
  );
$$;

revoke all on function public.can_manage_season_progress(uuid) from public, anon;
revoke all on function public.can_manage_participation_object(text) from public, anon;
grant execute on function public.can_manage_season_progress(uuid) to authenticated;
grant execute on function public.can_manage_participation_object(text) to authenticated;

drop policy if exists participation_select on public.participation_records;
create policy participation_select on public.participation_records
  for select using (
    public.is_admin()
    or mentee_id = auth.uid()
    or public.can_manage_season_progress(cohort_id)
  );

drop policy if exists participation_select_allowed on storage.objects;
create policy participation_select_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'participation'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or public.can_manage_participation_object(name)
    )
  );

commit;
