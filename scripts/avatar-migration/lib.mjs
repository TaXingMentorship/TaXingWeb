// Pure helpers for scripts/migrateAvatars.mjs: URL parsing and candidate
// filtering. No I/O here, so tests/avatarMigration.test.mjs can cover it
// without network, Supabase or sharp.

export const PUBLIC_AVATAR_MARKER = '/storage/v1/object/public/avatars/';
export const CANDIDATE_MIN_BYTES = 100 * 1024;
export const OUTPUT_MAX_BYTES = 50 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Splits a public avatar URL into its origin and object name. Returns null
 * for anything that is not a public `avatars` object of this project.
 */
export function parseAvatarUrl(avatarUrl, projectOrigin) {
  let url;
  try {
    url = new URL(avatarUrl);
  } catch {
    return null;
  }
  if (projectOrigin && url.origin !== projectOrigin) return null;
  if (!url.pathname.startsWith(PUBLIC_AVATAR_MARKER)) return null;
  const objectName = decodeURIComponent(url.pathname.slice(PUBLIC_AVATAR_MARKER.length));
  if (!objectName) return null;
  return { origin: url.origin, objectName };
}

export function publicAvatarUrl(origin, objectName) {
  return `${origin}${PUBLIC_AVATAR_MARKER}${objectName}`;
}

/**
 * Splits profiles into ones whose avatar lives in this project's public
 * `avatars` bucket and ones the script must not touch, with a reason.
 */
export function partitionProfiles(profiles, projectOrigin) {
  const avatars = [];
  const skipped = [];
  for (const profile of profiles) {
    const profileId = String(profile.id ?? '');
    const avatarUrl = String(profile.avatar_url ?? '').trim();
    if (!isUuid(profileId)) {
      skipped.push({ profileId, avatarUrl, reason: 'invalid profile id' });
      continue;
    }
    if (!avatarUrl) continue;
    const parsed = parseAvatarUrl(avatarUrl, projectOrigin);
    if (!parsed) {
      skipped.push({ profileId, avatarUrl, reason: 'not a public avatars url' });
      continue;
    }
    avatars.push({ profileId, avatarUrl, ...parsed });
  }
  return { avatars, skipped };
}

export function isCandidateSize(sizeBytes) {
  return Number.isFinite(sizeBytes) && sizeBytes > CANDIDATE_MIN_BYTES;
}
