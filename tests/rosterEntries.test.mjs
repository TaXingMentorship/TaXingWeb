import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEntries,
  filterEntries,
  inviteRows,
  inviteState,
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

test("inviteState: claimed is setup, otherwise waiting or out", () => {
  assert.equal(inviteState(invite("a", "a@x.com", { claimed_user_id: "u" })), "setup");
  assert.equal(inviteState(invite("a", "a@x.com")), "waiting");
  assert.equal(inviteState(invite("a", "a@x.com", { not_participating: true })), "out");
});

test("an unclaimed invite for an existing season member is not shown twice", () => {
  const member = profile("p1", "Ann@X.com");
  const stale = invite("i1", " ann@x.com ");
  const other = invite("i2", "bob@x.com");
  const rows = inviteRows([stale, other], [member], [member]);
  assert.deepEqual(rows.map((i) => i.id), ["i2"]);
});

test("a claimed invite with no profile is shown as setup; with a profile it is not", () => {
  const withProfile = invite("i1", "a@x.com", { claimed_user_id: "p1" });
  const noProfile = invite("i2", "b@x.com", { claimed_user_id: "ghost" });
  const rows = inviteRows([withProfile, noProfile], [profile("p1", "a@x.com")], []);
  assert.deepEqual(rows.map((i) => i.id), ["i2"]);
});

test("nothing is classified while profiles are still loading", () => {
  assert.deepEqual(inviteRows([invite("i1", "a@x.com")], undefined, []), []);
});

test("unclaimed rows list people who can still be chased before those flagged out", () => {
  const rows = inviteRows(
    [invite("out", "o@x.com", { not_participating: true }), invite("in", "i@x.com")],
    [],
    [],
  );
  assert.deepEqual(rows.map((i) => i.id), ["in", "out"]);
});

test("pendingInvites drops anyone whose email already has a profile, in any season", () => {
  const stale = invite("i1", "ann@x.com", { cohort_id: "next" });
  const waiting = invite("i2", "bob@x.com");
  const claimed = invite("i3", "c@x.com", { claimed_user_id: "u" });
  const rows = pendingInvites([stale, waiting, claimed], [profile("p1", "ann@x.com", { cohort_ids: ["old"] })]);
  assert.deepEqual(rows.map((i) => i.id), ["i2"]);
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
    ],
    [member],
  );
  const ids = (f) =>
    filterEntries(entries, { ...all, ...f }, new Map()).map((e) =>
      e.kind === "member" ? e.row.profile.id : e.invite.id,
    );
  assert.deepEqual(ids({ status: "active" }).sort(), ["p1", "setup"]);
  assert.deepEqual(ids({ status: "setup" }), ["setup"]);
  assert.deepEqual(ids({ status: "waiting" }), ["wait"]);
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
