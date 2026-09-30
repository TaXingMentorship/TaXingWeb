-- Let a bulletin post carry up to 4 images.
--
-- Storage path, not a public URL, in `image_paths` — same reason
-- `participation_records.screenshot_path` isn't a URL either: the bucket is
-- not public, so a viewer needs a freshly signed URL, not a stored one that
-- would eventually expire.
--
-- The bucket follows `participation`'s shape (0002), not `avatars`'s: board
-- content is the thing 0009 went out of its way to keep anonymous, so it
-- should not sit in a bucket anyone on the open internet can read. Read
-- access is wider than `participation` though — any signed-in member, not
-- just the uploader — because 0008 already opened bulletin reading to every
-- signed-in member.
--
-- 4 is a hard ceiling, not just a UI suggestion: the check constraint is the
-- backstop in case a request ever reaches the database directly.

alter table public.bulletin_posts
  add column if not exists image_paths text[] not null default '{}';

alter table public.bulletin_posts
  add constraint bulletin_posts_image_paths_max4
  check (array_length(image_paths, 1) is null or array_length(image_paths, 1) <= 4);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bulletin',
  'bulletin',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bulletin_images_select_member on storage.objects;
create policy bulletin_images_select_member on storage.objects
  for select to authenticated
  using (bucket_id = 'bulletin');

drop policy if exists bulletin_images_insert_own on storage.objects;
create policy bulletin_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bulletin'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists bulletin_images_delete_own_admin on storage.objects;
create policy bulletin_images_delete_own_admin on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'bulletin'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Readable view (0009) gains the new column under the same row boundary it
-- already enforces — no change to who can see a post also changes who can
-- see its images.
drop view if exists public.bulletin_posts_readable;
create view public.bulletin_posts_readable
with (security_invoker = false) as
select
  p.id, p.cohort_id, p.board_id,
  case
    when p.is_anonymous and not public.is_admin() and p.author_id is distinct from auth.uid()
    then null else p.author_id
  end as author_id,
  p.category, p.title, p.body, p.is_anonymous, p.color, p.pinned, p.resolved,
  p.image_paths, p.hidden, p.created_at
from public.bulletin_posts p
where p.hidden = false or p.author_id = auth.uid() or public.is_admin();

grant select on public.bulletin_posts_readable to authenticated;
