-- Archived boards are read-only for everyone, admins included.
--
-- 0015's insert policies gated writing on who the author is and on the
-- author's own seasons, but never on whether the season or board is still
-- open. `cohorts.bulletin_open` and `bulletin_boards.is_open` were enforced by
-- the UI alone, so a request that skipped the UI could still post to a closed
-- or archived board.
--
-- The checks live in two SECURITY DEFINER helpers rather than inline
-- subqueries: 0009 revoked SELECT on `bulletin_posts` from `authenticated`, so
-- a policy on comments or reactions could not look the post up as the caller.
--
-- Nothing else changes. Who may write (admin / participant / volunteer) and the
-- requirement that `cohort_id` is one of the writer's own seasons stay exactly
-- as 0015 left them, and UPDATE / DELETE are untouched so an admin can still
-- moderate (hide, pin, delete) an archived board.

create or replace function public.bulletin_board_is_writable(
  p_cohort_id uuid,
  p_board_id  uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bulletin_boards b
    join public.cohorts c on c.id = b.cohort_id
    where b.id = p_board_id
      and b.cohort_id = p_cohort_id
      and b.is_open
      and c.bulletin_open
  );
$$;

create or replace function public.bulletin_post_is_writable(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bulletin_posts p
    where p.id = p_post_id
      and public.bulletin_board_is_writable(p.cohort_id, p.board_id)
  );
$$;

revoke all on function public.bulletin_board_is_writable(uuid, uuid) from public;
revoke all on function public.bulletin_post_is_writable(uuid) from public;
grant execute on function public.bulletin_board_is_writable(uuid, uuid) to authenticated;
grant execute on function public.bulletin_post_is_writable(uuid) to authenticated;

drop policy if exists bulletin_insert_self on public.bulletin_posts;
create policy bulletin_insert_self on public.bulletin_posts
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
    and public.bulletin_board_is_writable(cohort_id, board_id)
  );

drop policy if exists bulletin_comments_insert_self on public.bulletin_comments;
create policy bulletin_comments_insert_self on public.bulletin_comments
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and author_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
    and public.bulletin_post_is_writable(post_id)
  );

drop policy if exists bulletin_reactions_insert_self on public.bulletin_reactions;
create policy bulletin_reactions_insert_self on public.bulletin_reactions
  for insert with check (
    (public.is_admin() or public.is_participant() or public.is_volunteer())
    and user_id = auth.uid()
    and cohort_id = any(public.current_cohort_ids())
    and public.bulletin_post_is_writable(post_id)
  );
