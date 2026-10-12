-- 成员收藏: a member's private bookmarks of other members (mentors / mentees).
--
-- Purely personal: the three policies below are all keyed on auth.uid(), so a
-- favourite is invisible to everyone else — including admins and the person
-- who was favourited. There is no UPDATE policy because a row has nothing to
-- edit. Both ids cascade, so deleting either account removes the bookmark.
--
-- The row stores only the pair. What the home page shows is read from
-- `profiles` at that moment, under the same RLS as the directory, so a person
-- who is hidden or no longer shares a season with the viewer simply drops out
-- of the list while the bookmark stays (it reappears if they come back).
-- Bookmarks are not tied to a season on purpose.

create table if not exists public.profile_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  target_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  constraint profile_favorites_not_self check (user_id <> target_id)
);

alter table public.profile_favorites enable row level security;

drop policy if exists profile_favorites_select_own on public.profile_favorites;
create policy profile_favorites_select_own on public.profile_favorites
  for select using (user_id = auth.uid());

drop policy if exists profile_favorites_insert_own on public.profile_favorites;
create policy profile_favorites_insert_own on public.profile_favorites
  for insert with check (user_id = auth.uid());

drop policy if exists profile_favorites_delete_own on public.profile_favorites;
create policy profile_favorites_delete_own on public.profile_favorites
  for delete using (user_id = auth.uid());

grant select, insert, delete on public.profile_favorites to authenticated;
