-- Step 1 of the legacy avatar migration. Read-only.
--
-- Lists every profile whose avatar is a public `avatars` object larger than
-- 100 KiB. Run it in the Supabase SQL editor, then export the result as CSV
-- and pass that file to `node scripts/migrateAvatars.mjs`.
--
-- Every row repeats the candidate count and total bytes, so the first row is
-- the summary to check before going further.

with avatar_objects as (
  select
    name,
    coalesce(
      nullif(metadata ->> 'size', '')::bigint,
      nullif(metadata ->> 'contentLength', '')::bigint,
      0
    ) as size_bytes
  from storage.objects
  where bucket_id = 'avatars'
),
candidates as (
  select
    p.id,
    p.avatar_url,
    o.name as object_name,
    o.size_bytes
  from public.profiles p
  join avatar_objects o
    on o.name = split_part(
      split_part(p.avatar_url, '/storage/v1/object/public/avatars/', 2),
      '?',
      1
    )
  where p.avatar_url is not null
    and o.size_bytes > 100 * 1024
)
select
  id,
  avatar_url,
  object_name,
  size_bytes,
  count(*) over () as total_count,
  pg_size_pretty(sum(size_bytes) over ()) as total_size
from candidates
order by size_bytes desc;
