import assert from "node:assert/strict";
import test from "node:test";
import { MENTOR_GROUP_COLORS, mentorGroupColors } from "../src/data/mentorGroupColors.ts";

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const group = (id, sort_order, name = id) => ({ id, sort_order, name, cohort_id: "c", direction: null, created_at: "" });

test("there are fourteen colours and no two are the same", () => {
  assert.equal(MENTOR_GROUP_COLORS.length, 14);
  assert.equal(new Set(MENTOR_GROUP_COLORS.map((c) => c.dot)).size, 14);
});

test("chip text reads on its tint at AA or better, with room to spare", () => {
  for (const c of MENTOR_GROUP_COLORS) {
    assert.ok(contrast(c.text, c.bg) >= 7, `${c.text} on ${c.bg}`);
  }
});

test("the dot is a visible stripe against a white card", () => {
  for (const c of MENTOR_GROUP_COLORS) assert.ok(contrast(c.dot, "#ffffff") >= 2.3, c.dot);
});

test("colours follow the group order, not the order the groups arrive in", () => {
  const a = mentorGroupColors([group("b", 2), group("a", 1), group("c", 3)]);
  const b = mentorGroupColors([group("c", 3), group("b", 2), group("a", 1)]);
  assert.equal(a.get("a"), MENTOR_GROUP_COLORS[0]);
  assert.equal(a.get("b"), MENTOR_GROUP_COLORS[1]);
  assert.equal(a.get("c"), MENTOR_GROUP_COLORS[2]);
  for (const id of ["a", "b", "c"]) assert.equal(a.get(id), b.get(id));
});

test("ties on sort_order fall back to the name; more than fourteen groups wrap", () => {
  const tied = mentorGroupColors([group("z", 0, "乙"), group("y", 0, "甲")]);
  assert.equal(tied.get("y"), MENTOR_GROUP_COLORS[0]);
  const many = mentorGroupColors(Array.from({ length: 16 }, (_, i) => group(`g${i}`, i)));
  assert.equal(many.get("g14"), MENTOR_GROUP_COLORS[0]);
  assert.equal(many.get("g15"), MENTOR_GROUP_COLORS[1]);
});
