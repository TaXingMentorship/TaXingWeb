import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApplySql,
  buildCheckSql,
  parseAvatarUrl,
  selectCandidates,
  sqlLiteral,
} from "../scripts/avatar-migration/lib.mjs";

const ORIGIN = "https://abc.supabase.co";
const ID = "11111111-2222-3333-4444-555555555555";
const url = (name) => `${ORIGIN}/storage/v1/object/public/avatars/${name}`;

test("parseAvatarUrl: strips the query string and decodes the name", () => {
  assert.deepEqual(parseAvatarUrl(`${url(`${ID}/my%20photo.jpg`)}?t=123`), {
    origin: ORIGIN,
    objectName: `${ID}/my photo.jpg`,
  });
});

test("parseAvatarUrl: rejects other buckets, signed URLs and junk", () => {
  assert.equal(parseAvatarUrl(`${ORIGIN}/storage/v1/object/public/bulletin/x.jpg`), null);
  assert.equal(parseAvatarUrl(`${ORIGIN}/storage/v1/object/sign/avatars/x.jpg`), null);
  assert.equal(parseAvatarUrl(`${ORIGIN}/proxy/storage/v1/object/public/avatars/x.jpg`), null);
  assert.equal(parseAvatarUrl("not a url"), null);
});

test("selectCandidates: only oversized public avatars, each profile once", () => {
  const big = { id: ID, avatar_url: url(`${ID}/a.jpg`), size_bytes: "921280" };
  const { candidates, skipped } = selectCandidates([
    big,
    { ...big },
    { id: "nope", avatar_url: url("x.jpg"), size_bytes: "999999" },
    { id: "21111111-2222-3333-4444-555555555555", avatar_url: url("y.webp"), size_bytes: "16664" },
    { id: "31111111-2222-3333-4444-555555555555", avatar_url: "https://elsewhere.com/z.jpg", size_bytes: "999999" },
    { id: "41111111-2222-3333-4444-555555555555", avatar_url: "", size_bytes: "999999" },
  ]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].objectName, `${ID}/a.jpg`);
  assert.equal(candidates[0].sizeBytes, 921280);
  assert.deepEqual(
    skipped.map((s) => s.reason),
    ["duplicate row", "invalid profile id", "already small enough", "not a public avatars url", "no avatar url"],
  );
});

test("sqlLiteral: doubles single quotes", () => {
  assert.equal(sqlLiteral("it's"), "'it''s'");
});

test("buildApplySql: compare-and-set on the old URL and requires the uploaded object", () => {
  const sql = buildApplySql([
    { profileId: ID, oldUrl: url(`${ID}/a.jpg`), newUrl: url(`${ID}/avatar-n.webp`), newObjectName: `${ID}/avatar-n.webp` },
  ]);
  assert.match(sql, /and p\.avatar_url = m\.old_url/);
  assert.match(sql, /o\.name = m\.new_object_name/);
  assert.match(sql, /on conflict do nothing/);
  assert.match(sql, /enable row level security/);
  assert.ok(sql.includes(`'${ID}'::uuid`));
  assert.ok(sql.includes(buildCheckSql([
    { profileId: ID, oldUrl: url(`${ID}/a.jpg`), newUrl: url(`${ID}/avatar-n.webp`), newObjectName: `${ID}/avatar-n.webp` },
  ])));
});
