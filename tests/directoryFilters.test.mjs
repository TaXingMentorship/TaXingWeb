import assert from "node:assert/strict";
import test from "node:test";
import { matchesGroupFilter, matchesSearch, visibleToMember } from "../src/lib/portal/directoryFilters.ts";

const profile = (extra = {}) => ({
  full_name: "Ann",
  bio: "Loves systems",
  background: "ex-Big Co",
  interests: ["AI", "Infra"],
  ...extra,
});

test("group filter: all passes everyone", () => {
  assert.equal(matchesGroupFilter("all", "g1"), true);
  assert.equal(matchesGroupFilter("all", undefined), true);
});

test("group filter: none is exactly the mentors without a group", () => {
  assert.equal(matchesGroupFilter("none", undefined), true);
  assert.equal(matchesGroupFilter("none", null), true);
  assert.equal(matchesGroupFilter("none", "g1"), false);
});

test("group filter: a group id keeps only that group", () => {
  assert.equal(matchesGroupFilter("g1", "g1"), true);
  assert.equal(matchesGroupFilter("g1", "g2"), false);
  assert.equal(matchesGroupFilter("g1", undefined), false);
});

test("search: an empty query matches everything", () => {
  assert.equal(matchesSearch("", profile()), true);
  assert.equal(matchesSearch("   ", profile()), true);
});

test("search: name, bio, background and interests, case-insensitively", () => {
  assert.equal(matchesSearch("ann", profile()), true);
  assert.equal(matchesSearch("SYSTEMS", profile()), true);
  assert.equal(matchesSearch("big co", profile()), true);
  assert.equal(matchesSearch("infra", profile()), true);
  assert.equal(matchesSearch("nothing here", profile()), false);
});

test("search: finds a mentor by the name of their answer group", () => {
  assert.equal(matchesSearch("产品经理", profile(), "产品经理与产品策略类 2"), true);
  assert.equal(matchesSearch("策略类 2", profile(), "产品经理与产品策略类 2"), true);
  assert.equal(matchesSearch("产品经理", profile(), null), false);
  assert.equal(matchesSearch("产品经理", profile()), false);
});

test("search: each field is tested on its own, a query does not span two fields", () => {
  assert.equal(matchesSearch("ann loves", profile()), false);
});

test("search: missing fields do not throw", () => {
  assert.equal(matchesSearch("x", profile({ full_name: null, bio: null, background: null, interests: [] })), false);
});

test("visibleToMember: needs a visible profile and a shared season", () => {
  assert.equal(visibleToMember({ visible: true, cohort_ids: ["a", "b"] }, ["b"]), true);
  assert.equal(visibleToMember({ visible: false, cohort_ids: ["a"] }, ["a"]), false);
  assert.equal(visibleToMember({ visible: true, cohort_ids: ["a"] }, ["z"]), false);
  assert.equal(visibleToMember({ visible: true, cohort_ids: [] }, []), false);
});
