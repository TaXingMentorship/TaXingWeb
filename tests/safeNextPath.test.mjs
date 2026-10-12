import assert from "node:assert/strict";
import test from "node:test";
import { safePortalNextPath } from "../src/lib/portal/safeNextPath.ts";

const origin = "https://portal.example";

test("keeps valid portal destinations and their query string", () => {
  assert.equal(
    safePortalNextPath("/portal/tasks?filter=mine#today", origin),
    "/portal/tasks?filter=mine#today",
  );
});

test("rejects destinations that become another origin after URL parsing", () => {
  for (const encoded of ["%2F%0A%2Fevil.example", "%2F%09%2Fevil.example"]) {
    const value = new URLSearchParams(`next=${encoded}`).get("next");
    assert.equal(safePortalNextPath(value, origin), "/portal");
  }
});

test("rejects external and non-portal destinations", () => {
  for (const value of ["//evil.example", "/\\evil.example", "/about", null]) {
    assert.equal(safePortalNextPath(value, origin), "/portal");
  }
});
