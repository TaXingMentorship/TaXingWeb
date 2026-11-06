begin;

-- Read only the caller's mentors, bypassing matches RLS to avoid policy recursion.
create or replace function public.my_mentorship_mentor_ids(p_cohort_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct m.mentor_id), '{}'::uuid[])
  from public.matches m
  where m.mentee_id = auth.uid()
    and m.cohort_id = p_cohort_id
    and p_cohort_id = any(public.current_cohort_ids());
$$;

revoke all on function public.my_mentorship_mentor_ids(uuid) from public, anon;
grant execute on function public.my_mentorship_mentor_ids(uuid) to authenticated;

-- Existing involved/admin policies and all write policies remain unchanged.
create policy matches_select_mentorship_siblings on public.matches
  for select to authenticated
  using (
    cohort_id = any(public.current_cohort_ids())
    and mentor_id = any(public.my_mentorship_mentor_ids(cohort_id))
  );

commit;
