import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntries,
  classifyInvites,
  filterEntries,
  inviteRows,
  pendingInvites,
  selectableMentorIds,
} from "../src/lib/portal/rosterEntries.ts";

const profile = (id, email, extra = {}) => ({
  id,
  email,
  full_name: id,
  wechat_number: null,
  admin_notes: null,
  participant_role: "mentor",
  is_volunteer: false,
  is_admin: false,
  cohort_ids: ["fall"],
  ...extra,
});
const invite = (id, email, extra = {}) => ({
  id,
  email,
  full_name: id,
  cohort_id: "fall",
  participant_role: "mentee",
  is_volunteer: false,
  is_admin: false,
  claimed_user_id: null,
  not_participating: false,
  ...extra,
});
const row = (p) => ({
  profile: p,
  sessionCount: 0,
  submitted: null,
  gaveGratitude: null,
  completedAll: false,
});
const all = { search: "", role: "all", status: "all", done: "all", group: "all" };

test("claimed with no profile is setup; claimed with a profile needs no row", () => {
  const rows = classifyInvites(
    [
      invite("withProfile", "a@x.com", { claimed_user_id: "p1" }),
      invite("noProfile", "b@x.com", { claimed_user_id: "ghost" }),
    ],
    [profile("p1", "a@x.com")],
  );
  assert.deepEqual(rows.map((r) => [r.invite.id, r.state]), [["noProfile", "setup"]]);
});

test("unclaimed: no account is waiting or out", () => {
  const rows = classifyInvites(
    [invite("out", "o@x.com", { not_participating: true }), invite("in", "i@x.com")],
    [],
  );
  assert.deepEqual(rows.map((r) => [r.invite.id, r.state]), [["in", "waiting"], ["out", "out"]]);
});

test("an unclaimed invite for someone already a member of that season is not shown twice", () => {
  const member = profile("p1", "Ann@X.com");
  const rows = classifyInvites([invite("stale", " ann@x.com ")], [member]);
  assert.deepEqual(rows, []);
});

test("a re-imported existing account that was never added to the season is 'account'", () => {
  // The import does not add the new season to an account that already exists.
  const old = profile("p1", "ann@x.com", { cohort_ids: ["old"] });
  const noRole = profile("p2", "bo@x.com", { participant_role: null });
  const rows = classifyInvites(
    [invite("i1", "ann@x.com"), invite("i2", "bo@x.com"), invite("i3", "ann@x.com", { not_participating: true })],
    [old, noRole],
  );
  assert.deepEqual(
    rows.map((r) => [r.invite.id, r.state]).sort(),
    [["i1", "account"], ["i2", "account"], ["i3", "out"]],
  );
});

test("the roster table and the 待激活 list classify the same invite the same way", () => {
  const old = profile("p1", "ann@x.com", { cohort_ids: ["old"] });
  const member = profile("p2", "bo@x.com");
  const invites = [
    invite("account", "ann@x.com"),
    invite("dup", "bo@x.com"),
    invite("wait", "w@x.com"),
    invite("out", "o@x.com", { not_participating: true }),
  ];
  const profiles = [old, member];
  const inTable = buildEntries([row(member)], invites, profiles)
    .filter((e) => e.kind === "invited")
    .map((e) => [e.invite.id, e.state]);
  const inList = pendingInvites(invites, profiles).map((r) => [r.invite.id, r.state]);
  assert.deepEqual(inTable, inList);
  assert.deepEqual(inList.map(([id]) => id), ["account", "wait", "out"]); // "dup" is shown as a member
});

test("nothing is classified while profiles are still loading", () => {
  assert.deepEqual(inviteRows([invite("i1", "a@x.com")], undefined), []);
  assert.deepEqual(pendingInvites([invite("i1", "a@x.com")], undefined), []);
});

test("pendingInvites leaves claimed invites out", () => {
  const rows = pendingInvites(
    [invite("claimed", "c@x.com", { claimed_user_id: "ghost" }), invite("wait", "w@x.com")],
    [],
  );
  assert.deepEqual(rows.map((r) => r.invite.id), ["wait"]);
});

test("select all covers only the mentors the filter still shows", () => {
  const a = profile("a", "a@x.com");
  const b = profile("b", "b@x.com");
  const c = profile("c", "c@x.com");
  const mentee = profile("m", "m@x.com", { participant_role: "mentee" });
  const entries = buildEntries([row(a), row(b), row(c), row(mentee)], [], []);
  const groupOfMentor = new Map([["a", "g1"], ["b", "g1"]]); // only c is unassigned
  const shown = filterEntries(entries, { ...all, group: "none" }, groupOfMentor);
  assert.deepEqual(selectableMentorIds(shown), ["c"]);
  assert.deepEqual(selectableMentorIds(entries).sort(), ["a", "b", "c"]);
});

test("status and role filters", () => {
  const member = profile("p1", "p1@x.com");
  const entries = buildEntries(
    [row(member)],
    [
      invite("wait", "w@x.com"),
      invite("out", "o@x.com", { not_participating: true }),
      invite("setup", "s@x.com", { claimed_user_id: "ghost" }),
      invite("acct", "old@x.com"),
    ],
    [member, profile("old", "old@x.com", { cohort_ids: ["elsewhere"] })],
  );
  const ids = (f) =>
    filterEntries(entries, { ...all, ...f }, new Map()).map((e) =>
      e.kind === "member" ? e.row.profile.id : e.invite.id,
    );
  assert.deepEqual(ids({ status: "active" }).sort(), ["p1", "setup"]);
  assert.deepEqual(ids({ status: "setup" }), ["setup"]);
  assert.deepEqual(ids({ status: "waiting" }), ["wait"]);
  assert.deepEqual(ids({ status: "account" }), ["acct"]);
  assert.deepEqual(ids({ status: "out" }), ["out"]);
  assert.deepEqual(ids({ role: "mentor" }), ["p1"]);
  // the completion filter only speaks about activated members
  assert.deepEqual(ids({ done: "todo" }), ["p1"]);
});

import { clampPage } from "../src/lib/portal/paging.ts";

test("clampPage pulls an out-of-range page back to the last real page", () => {
  assert.equal(clampPage(0, 0, 25), 0); // empty list
  assert.equal(clampPage(2, 51, 25), 2); // 51 rows → pages 0..2
  assert.equal(clampPage(2, 50, 25), 1); // one row removed: page 2 no longer exists
  assert.equal(clampPage(5, 3, 25), 0);
  assert.equal(clampPage(-1, 100, 25), 0);
});
