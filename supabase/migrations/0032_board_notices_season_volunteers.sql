-- 留言须知 / 志愿者提醒 are edited by admins and by that season's volunteers.
--
-- 0031 let a volunteer edit notices on any board of a season in their
-- `cohort_ids`. But `profiles.is_volunteer` is one flag with no season: someone
-- who volunteered in an earlier season and is a mentor or mentee this season
-- keeps it, and their `cohort_ids` holds this season too — so they could edit
-- this season's notices. The volunteer roster is what says who volunteered
-- *when*: a volunteer of a season is a profile linked (`volunteers.profile_id`)
-- to a record with a `volunteer_seasons` row for it.
--
-- `profiles.is_volunteer` itself stays as it is; only this policy changes.

create or replace function public.is_season_volunteer(p_cohort_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.volunteers v
    join public.volunteer_seasons vs on vs.volunteer_id = v.id
    where v.profile_id = auth.uid()
      and vs.cohort_id = p_cohort_id
  );
$$;

revoke all on function public.is_season_volunteer(uuid) from public;
grant execute on function public.is_season_volunteer(uuid) to authenticated;

drop policy if exists board_notices_staff_all on public.board_notices;
create policy board_notices_staff_all on public.board_notices
  for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.bulletin_boards b
      where b.id = board_id and public.is_season_volunteer(b.cohort_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.bulletin_boards b
      where b.id = board_id and public.is_season_volunteer(b.cohort_id)
    )
  );
