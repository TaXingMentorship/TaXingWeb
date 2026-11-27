-- 0059: activity-record screenshots must live in the mentee's own folder.
--
-- participation_insert_self / participation_modify_own (0004) only checked
-- mentee_id, so a mentee could point screenshot_path at any object in the
-- `participation` bucket. 0058 made that matter: progress managers read
-- screenshots through can_manage_participation_object(name), which trusted
-- the path, and /api/admin/participation removes the path with the service
-- role. Uploads are always `<mentee_id>/<random>.<ext>`
-- (uploadParticipationScreenshot), so require exactly that.
--
-- 0058 also dropped the is_mentee() gate on reading your own folder; restore
-- it as 0004 had it.
--
-- Before applying, check existing rows (should return nothing):
--   select id, mentee_id, screenshot_path
--   from public.participation_records
--   where screenshot_path is not null
--     and (storage.foldername(screenshot_path))[1] is distinct from mentee_id::text;

begin;

drop policy if exists participation_insert_self on public.participation_records;
create policy participation_insert_self on public.participation_records
  for insert with check (
    (public.is_admin() or public.is_mentee())
    and mentee_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
    and (
      screenshot_path is null
      or (storage.foldername(screenshot_path))[1] = mentee_id::text
    )
  );

drop policy if exists participation_modify_own on public.participation_records;
create policy participation_modify_own on public.participation_records
  for update using (
    public.is_admin() or (public.is_mentee() and mentee_id = auth.uid())
  )
  with check (
    (public.is_admin() or (public.is_mentee() and mentee_id = auth.uid()))
    and (
      screenshot_path is null
      or (storage.foldername(screenshot_path))[1] = mentee_id::text
    )
  );

-- Only an object in the record's own mentee folder resolves to its season.
create or replace function public.can_manage_participation_object(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participation_records r
    where r.screenshot_path = p_name
      and (storage.foldername(p_name))[1] = r.mentee_id::text
      and public.can_manage_season_progress(r.cohort_id)
  );
$$;

drop policy if exists participation_select_allowed on storage.objects;
create policy participation_select_allowed on storage.objects
  for select to authenticated
  using (
    bucket_id = 'participation'
    and (
      public.is_admin()
      or (public.is_mentee() and (storage.foldername(name))[1] = auth.uid()::text)
      or public.can_manage_participation_object(name)
    )
  );

commit;
