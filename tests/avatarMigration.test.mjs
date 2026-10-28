import assert from "node:assert/strict";
import test from "node:test";
import {
  isCandidateSize,
  parseAvatarUrl,
  partitionProfiles,
} from "../scripts/avatar-migration/lib.mjs";

const ORIGIN = "https://abc.supabase.co";
const ID = "11111111-2222-3333-4444-555555555555";
const url = (name, origin = ORIGIN) => `${origin}/storage/v1/object/public/avatars/${name}`;

test("parseAvatarUrl: strips the query string and decodes the name", () => {
  assert.deepEqual(parseAvatarUrl(`${url(`${ID}/my%20photo.jpg`)}?t=123`, ORIGIN), {
    origin: ORIGIN,
    objectName: `${ID}/my photo.jpg`,
  });
});

test("parseAvatarUrl: rejects other projects, buckets, signed URLs and junk", () => {
  assert.equal(parseAvatarUrl(url("x.jpg", "https://other.supabase.co"), ORIGIN), null);
  assert.equal(parseAvatarUrl(`${ORIGIN}/storage/v1/object/public/bulletin/x.jpg`, ORIGIN), null);
  assert.equal(parseAvatarUrl(`${ORIGIN}/storage/v1/object/sign/avatars/x.jpg`, ORIGIN), null);
  assert.equal(parseAvatarUrl(`${ORIGIN}/proxy/storage/v1/object/public/avatars/x.jpg`, ORIGIN), null);
  assert.equal(parseAvatarUrl(url(""), ORIGIN), null);
  assert.equal(parseAvatarUrl("not a url", ORIGIN), null);
});

test("partitionProfiles: keeps this project's avatars, reports the rest", () => {
  const { avatars, skipped } = partitionProfiles(
    [
      { id: ID, avatar_url: url(`${ID}/a.jpg`) },
      { id: "21111111-2222-3333-4444-555555555555", avatar_url: null },
      { id: "31111111-2222-3333-4444-555555555555", avatar_url: "https://elsewhere.com/z.jpg" },
      { id: "nope", avatar_url: url("x.jpg") },
    ],
    ORIGIN,
  );
  assert.deepEqual(avatars, [
    { profileId: ID, avatarUrl: url(`${ID}/a.jpg`), origin: ORIGIN, objectName: `${ID}/a.jpg` },
  ]);
  assert.deepEqual(
    skipped.map((s) => s.reason),
    ["not a public avatars url", "invalid profile id"],
  );
});

test("isCandidateSize: strictly over 100 KiB", () => {
  assert.equal(isCandidateSize(100 * 1024), false);
  assert.equal(isCandidateSize(100 * 1024 + 1), true);
  assert.equal(isCandidateSize(NaN), false);
});
