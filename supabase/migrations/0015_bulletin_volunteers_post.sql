-- Volunteers may post, comment and react on the bulletin board.
--
-- The insert policies from 0004/0006 admitted only admins and participants
-- (`is_admin() or is_participant()`), so a volunteer-only account could read
-- every board but never write to one. Volunteers run the seasons; they belong
-- on the wall. The season gate is unchanged: `cohort_id` must still be one of
-- the writer's own `profiles.cohort_ids`.

create or replace function public.is_volunteer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_volunteer
  );
$$;

revoke all on function public.is_volunteer() from public;
grant execute on function public.is_volunteer() to authenticated;

drop policy if exists bulletin_insert_self on public.bulletin_posts;
create policy bulletin_insert_self on public.bulletin_posts
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists bulletin_comments_insert_self on public.bulletin_comments;
create policy bulletin_comments_insert_self on public.bulletin_comments
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );

drop policy if exists bulletin_reactions_insert_self on public.bulletin_reactions;
create policy bulletin_reactions_insert_self on public.bulletin_reactions
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and user_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
  );
