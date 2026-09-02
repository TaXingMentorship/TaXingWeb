-- Open bulletin reading across every season.
--
-- Reading was cohort-scoped from 0001: you could only see boards and posts from
-- seasons you took part in. Past graduation walls and Q&A archives are worth
-- reading for newcomers, so SELECT is now open to any signed-in member.
--
-- WRITING IS UNCHANGED. The insert policies still require
-- `cohort_id = any(current_cohort_ids())`, so a non-member can read another
-- season but cannot post, comment, or react in it. 0007's admin-only UPDATE
-- also stays as-is.
--
-- `profiles` is deliberately NOT widened: cross-season authors resolve to
-- nothing and the UI shows them as 「往期成员」, so past content is readable
-- without exposing every past member's profile to every new participant.
--
-- Each policy REPLACES its cohort-scoped predecessor rather than sitting
-- alongside it — permissive policies are OR'd, and leaving both would make the
-- effective rule hard to read.

-- cohorts ------------------------------------------------------------------
drop policy if exists cohorts_select_member on public.cohorts;
drop policy if exists cohorts_select_all on public.cohorts;
create policy cohorts_select_all on public.cohorts
  for select to authenticated using (true);

-- bulletin_boards ----------------------------------------------------------
drop policy if exists boards_select_cohort on public.bulletin_boards;
drop policy if exists boards_select_all on public.bulletin_boards;
create policy boards_select_all on public.bulletin_boards
  for select to authenticated using (true);

-- bulletin_posts -----------------------------------------------------------
drop policy if exists bulletin_select_cohort on public.bulletin_posts;
drop policy if exists bulletin_select_all on public.bulletin_posts;
create policy bulletin_select_all on public.bulletin_posts
  for select to authenticated using (
    hidden = false or author_id = auth.uid() or public.is_admin()
  );

-- bulletin_comments --------------------------------------------------------
drop policy if exists bulletin_comments_select_cohort on public.bulletin_comments;
drop policy if exists bulletin_comments_select_all on public.bulletin_comments;
create policy bulletin_comments_select_all on public.bulletin_comments
  for select to authenticated using (
    hidden = false or author_id = auth.uid() or public.is_admin()
  );

-- bulletin_reactions -------------------------------------------------------
drop policy if exists bulletin_reactions_select_cohort on public.bulletin_reactions;
drop policy if exists bulletin_reactions_select_all on public.bulletin_reactions;
create policy bulletin_reactions_select_all on public.bulletin_reactions
  for select to authenticated using (true);
