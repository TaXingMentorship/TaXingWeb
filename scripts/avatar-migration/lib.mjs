// Pure helpers for scripts/migrateAvatars.mjs: URL parsing, candidate
// filtering and the SQL the operator runs by hand. No I/O here, so
// tests/avatarMigration.test.mjs can cover it without network or sharp.

export const PUBLIC_AVATAR_MARKER = '/storage/v1/object/public/avatars/';
export const CANDIDATE_MIN_BYTES = 100 * 1024;
export const OUTPUT_MAX_BYTES = 50 * 1024;
export const BACKUP_TABLE = 'public.avatar_migration_backup';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Splits a public avatar URL into the project origin and the object name,
 * the same way preview.sql does. Returns null for anything that is not a
 * public `avatars` object.
 */
export function parseAvatarUrl(avatarUrl) {
  let url;
  try {
    url = new URL(avatarUrl);
  } catch {
    return null;
  }
  const index = url.pathname.indexOf(PUBLIC_AVATAR_MARKER);
  if (index !== 0) return null;
  const objectName = decodeURIComponent(url.pathname.slice(PUBLIC_AVATAR_MARKER.length));
  if (!objectName) return null;
  return { origin: url.origin, objectName };
}

export function publicAvatarUrl(origin, objectName) {
  return `${origin}${PUBLIC_AVATAR_MARKER}${objectName}`;
}

/**
 * Turns preview.sql rows into work items. Anything the script must not touch
 * comes back in `skipped` with a reason, so the summary can report it.
 */
export function selectCandidates(rows) {
  const candidates = [];
  const skipped = [];
  const seen = new Set();

  for (const row of rows) {
    const profileId = String(row.id ?? '').trim();
    const avatarUrl = String(row.avatar_url ?? '').trim();
    const sizeBytes = Number(row.size_bytes);

    if (!isUuid(profileId)) {
      skipped.push({ profileId, avatarUrl, reason: 'invalid profile id' });
      continue;
    }
    if (seen.has(profileId)) {
      skipped.push({ profileId, avatarUrl, reason: 'duplicate row' });
      continue;
    }
    seen.add(profileId);
    if (!avatarUrl) {
      skipped.push({ profileId, avatarUrl, reason: 'no avatar url' });
      continue;
    }
    const parsed = parseAvatarUrl(avatarUrl);
    if (!parsed) {
      skipped.push({ profileId, avatarUrl, reason: 'not a public avatars url' });
      continue;
    }
    if (!Number.isFinite(sizeBytes) || sizeBytes <= CANDIDATE_MIN_BYTES) {
      skipped.push({ profileId, avatarUrl, reason: 'already small enough' });
      continue;
    }
    candidates.push({ profileId, avatarUrl, ...parsed, sizeBytes });
  }

  return { candidates, skipped };
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function mappingValues(migrated) {
  return migrated
    .map(
      (m) =>
        `    (${sqlLiteral(m.profileId)}::uuid, ${sqlLiteral(m.oldUrl)}, ${sqlLiteral(m.newUrl)}, ${sqlLiteral(m.newObjectName)})`,
    )
    .join(',\n');
}

/**
 * Status of every converted avatar. Shared by check.sql and the tail of
 * apply.sql so the operator sees the outcome right after applying.
 */
export function buildCheckSql(migrated) {
  return `with mapping(profile_id, old_url, new_url, new_object_name) as (
  values
${mappingValues(migrated)}
)
select
  m.profile_id,
  case
    when p.id is null then '账号已不存在'
    when p.avatar_url = m.new_url then '已换成新图'
    when not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'avatars' and o.name = m.new_object_name
    ) then '新图还没上传'
    when p.avatar_url = m.old_url then '新图已上传，还没换'
    else '用户自己换过头像，已跳过（新图没用上）'
  end as status,
  m.new_url
from mapping m
left join public.profiles p on p.id = m.profile_id
order by status, m.profile_id;
`;
}

/**
 * Points each profile at its new avatar, but only when the new object is
 * already in Storage and the profile still has the URL this run converted.
 * A profile whose owner changed their avatar meanwhile is left alone. Every
 * switched row is recorded in the backup table, which rollback.sql reads.
 */
export function buildApplySql(migrated) {
  return `-- 把头像换成新的小图。可以重复运行，已经换过的不会再动。
begin;

create table if not exists ${BACKUP_TABLE} (
  profile_id uuid not null,
  old_url text not null,
  new_url text not null,
  new_object_name text not null,
  migrated_at timestamptz not null default now(),
  primary key (profile_id, new_url)
);
alter table ${BACKUP_TABLE} enable row level security;
revoke all on ${BACKUP_TABLE} from anon, authenticated;

with mapping(profile_id, old_url, new_url, new_object_name) as (
  values
${mappingValues(migrated)}
),
switched as (
  update public.profiles p
  set avatar_url = m.new_url
  from mapping m
  where p.id = m.profile_id
    and p.avatar_url = m.old_url
    and exists (
      select 1 from storage.objects o
      where o.bucket_id = 'avatars' and o.name = m.new_object_name
    )
  returning p.id, m.old_url, m.new_url, m.new_object_name
)
insert into ${BACKUP_TABLE} (profile_id, old_url, new_url, new_object_name)
select id, old_url, new_url, new_object_name from switched
on conflict do nothing;

commit;

-- 结果：
${buildCheckSql(migrated)}`;
}

export function buildRollbackSql() {
  return `-- 把这次换过的头像全部换回原图。
-- 用户在迁移之后自己换过的头像不会被改动。
update public.profiles p
set avatar_url = b.old_url
from ${BACKUP_TABLE} b
where p.id = b.profile_id
  and p.avatar_url = b.new_url
returning p.id, p.avatar_url;
`;
}
