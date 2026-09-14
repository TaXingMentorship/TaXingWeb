-- Restrict bulletin UPDATE to admins.
--
-- The previous policies let an author update ANY column of their own row —
-- including `hidden`, so an author could undo a moderator's decision by
-- calling the API directly, and `pinned`, so they could pin themselves. The
-- UI never offered either, but the API was open.
--
-- Every flag change now goes through /api/admin/moderation, which uses the
-- service-role client (RLS does not apply) and authorizes in code: `resolved`
-- is allowed for the post's author or an admin, `pinned`/`hidden` for admins
-- only. So authors no longer need direct UPDATE at all.
--
-- DELETE policies are deliberately left alone: authors must keep being able to
-- delete their own posts and comments.

drop policy if exists bulletin_update_author_admin on public.bulletin_posts;
drop policy if exists bulletin_update_admin on public.bulletin_posts;
create policy bulletin_update_admin on public.bulletin_posts
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists bulletin_comments_update_author_admin on public.bulletin_comments;
drop policy if exists bulletin_comments_update_admin on public.bulletin_comments;
create policy bulletin_comments_update_admin on public.bulletin_comments
  for update using (public.is_admin()) with check (public.is_admin());
