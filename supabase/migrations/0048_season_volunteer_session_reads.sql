-- Season volunteers can read the pairings and session logs they manage.
drop policy if exists sessions_select_season_staff on public.sessions_log;
create policy sessions_select_season_staff on public.sessions_log
  for select using (
    public.is_admin() or public.is_season_volunteer(cohort_id)
  );

drop policy if exists matches_select_season_staff on public.matches;
create policy matches_select_season_staff on public.matches
  for select using (
    public.is_admin() or public.is_season_volunteer(cohort_id)
  );
