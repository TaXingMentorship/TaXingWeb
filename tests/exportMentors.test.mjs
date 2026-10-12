import assert from "node:assert/strict";
import test from "node:test";
import { portalCopy } from "../src/data/portalCopy.ts";
import {
  buildMentorsCsv,
  canExportMentors,
  csvCell,
  exportFileName,
} from "../src/lib/portal/exportMentors.ts";

const copy = portalCopy.directoryExport;

const mentor = (extra = {}) => ({
  id: "m1",
  participant_role: "mentor",
  is_admin: false,
  is_volunteer: false,
  cohort_ids: ["fall"],
  full_name: "Ann",
  email: "ann.secret@example.com",
  wechat_number: "ann_wechat_id",
  admin_notes: "internal note: do not share",
  bio: "Loves systems",
  field: "后端",
  background: "ex-Big Co",
  interests: ["AI", "Infra"],
  linkedin: "https://linkedin.com/in/ann",
  avatar_url: "https://cdn.example.com/a.png",
  visible: true,
  years_experience: "8 年",
  mentee_capacity: "2",
  mentee_expectations: "主动沟通",
  topics: "擅长：架构；不擅长：设计",
  help_needed: null,
  created_at: "",
  updated_at: "",
  ...extra,
});
const entry = (extra = {}, rest = {}) => ({ profile: mentor(extra), groupName: "产品经理 组2", ...rest });

test("csv: UTF-8 BOM first, CRLF line ends, one header plus one row per mentor", () => {
  const csv = buildMentorsCsv([entry(), entry({ id: "m2", full_name: "Bo" })], copy);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 4); // header + 2 rows + the empty piece after the last CRLF
  assert.equal(lines[3], "");
  assert.ok(lines[0].startsWith(copy.fields.name + "," + copy.fields.field));
});

test("csv: the header is the ProfileDialog fields, in order", () => {
  const header = buildMentorsCsv([], copy).slice(1).split("\r\n")[0];
  assert.equal(
    header,
    [
      "name", "field", "bio", "background", "yearsExperience", "menteeCapacity",
      "menteeExpectations", "topics", "interests", "group", "linkedin",
    ].map((k) => csvCell(copy.fields[k])).join(","),
  );
});

test("csv: a row carries the group, the joined interests and LinkedIn", () => {
  const row = buildMentorsCsv([entry()], copy).slice(1).split("\r\n")[1];
  assert.ok(row.includes("产品经理 组2"));
  assert.ok(row.includes("AI、Infra"));
  assert.ok(row.includes("https://linkedin.com/in/ann"));
});

test("csv: commas, quotes and line breaks are escaped", () => {
  assert.equal(csvCell("plain"), "plain");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("line1\r\nline2"), '"line1\r\nline2"');
  assert.equal(csvCell(" padded "), '" padded "');
  const csv = buildMentorsCsv([entry({ bio: 'one, two\n"three"' })], copy);
  assert.ok(csv.includes('"one, two\n""three"""'));
});

test("csv: a member-written cell cannot run as an Excel formula", () => {
  assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), `"'=HYPERLINK(""http://evil"")"`);
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("@sum"), "'@sum");
  assert.equal(csvCell("-2"), "'-2");
  assert.equal(csvCell("3 - 2"), "3 - 2"); // only a leading character matters
});

test("csv: an empty field is an empty cell, so the columns stay aligned", () => {
  const csv = buildMentorsCsv(
    [entry({ bio: null, linkedin: null, interests: [], topics: "   " }, { groupName: null })],
    copy,
  );
  const row = csv.slice(1).split("\r\n")[1];
  assert.equal(row.split(",").length, 11); // none of the values here contain commas
});

test("no contact details anywhere in the file", () => {
  const csv = buildMentorsCsv([entry()], copy);
  for (const secret of ["ann.secret@example.com", "ann_wechat_id", "internal note", "mailto:"]) {
    assert.ok(!csv.includes(secret), `csv leaked ${secret}`);
  }
  // the header names no contact column either
  assert.ok(!/邮箱|微信|email|wechat/i.test(csv.split("\r\n")[0]));
  // and the avatar's remote address is not exported
  assert.ok(!csv.includes("cdn.example.com"));
});

test("canExportMentors: admins, and volunteers of the season, only", () => {
  const season = new Set(["vol"]);
  assert.equal(canExportMentors({ isAdmin: true, userId: "x", seasonVolunteerIds: season }), true);
  assert.equal(canExportMentors({ isAdmin: false, userId: "vol", seasonVolunteerIds: season }), true);
  assert.equal(canExportMentors({ isAdmin: false, userId: "mentor", seasonVolunteerIds: season }), false);
  assert.equal(canExportMentors({ isAdmin: false, userId: "mentee", seasonVolunteerIds: new Set() }), false);
  assert.equal(canExportMentors({ isAdmin: false, userId: null, seasonVolunteerIds: season }), false);
  assert.equal(canExportMentors({ isAdmin: false, userId: undefined, seasonVolunteerIds: season }), false);
});

test("file name: season and local date, safe characters only", () => {
  assert.equal(exportFileName("2026 秋季", "2026-10-12"), "导师信息-2026秋季-20261012.csv");
  assert.equal(exportFileName("a/b:c", "2026-01-02"), "导师信息-abc-20260102.csv");
});
