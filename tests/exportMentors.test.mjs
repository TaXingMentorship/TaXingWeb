import assert from "node:assert/strict";
import test from "node:test";
import { portalCopy } from "../src/data/portalCopy.ts";
import {
  buildMentorsCsv,
  buildMentorsHtml,
  canExportMentors,
  csvCell,
  escapeHtml,
  exportFileName,
  initialOf,
  mentorFields,
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
const entry = (extra = {}, rest = {}) => ({
  profile: mentor(extra),
  groupName: "产品经理 组2",
  avatar: null,
  ...rest,
});

const SECRETS = ["ann.secret@example.com", "ann_wechat_id", "internal note", "mailto:"];

test("fields: an empty or whitespace-only field is left out entirely", () => {
  const fields = mentorFields(
    entry({ bio: "   ", background: null, topics: "", interests: [], years_experience: "8 年" }, { groupName: null }),
    copy,
    { linkedin: true },
  );
  assert.deepEqual(
    fields.map((f) => f.key),
    ["field", "yearsExperience", "menteeCapacity", "menteeExpectations", "linkedin"],
  );
  assert.ok(fields.every((f) => f.value.trim() !== ""));
});

test("fields: ProfileDialog's order, with the answer group and interests", () => {
  const keys = mentorFields(entry(), copy, { linkedin: false }).map((f) => f.key);
  assert.deepEqual(keys, [
    "field", "bio", "background", "yearsExperience", "menteeCapacity",
    "menteeExpectations", "topics", "interests", "group",
  ]);
  const interests = mentorFields(entry(), copy, { linkedin: false }).find((f) => f.key === "interests");
  assert.equal(interests.value, "AI、Infra");
});

test("csv: UTF-8 BOM first, CRLF line ends, one header plus one row per mentor", () => {
  const csv = buildMentorsCsv([entry(), entry({ id: "m2", full_name: "Bo" })], copy);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 4); // header + 2 rows + trailing empty after the last CRLF
  assert.equal(lines[3], "");
  assert.ok(lines[0].startsWith(copy.fields.name + "," + copy.fields.field));
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
  const csv = buildMentorsCsv([entry({ bio: null, linkedin: null }, { groupName: null })], copy);
  const row = csv.slice(1).split("\r\n")[1];
  assert.equal(row.split(",").length, 11); // none of the values here contain commas
});

test("no contact details anywhere, in either file", () => {
  const entries = [entry()];
  const csv = buildMentorsCsv(entries, copy);
  const html = buildMentorsHtml(entries, { season: "2026秋季", exportedOn: "2026-10-12", copy });
  for (const secret of SECRETS) {
    assert.ok(!csv.includes(secret), `csv leaked ${secret}`);
    assert.ok(!html.includes(secret), `html leaked ${secret}`);
  }
  // the header names no contact column either
  assert.ok(!/邮箱|微信|email|wechat/i.test(csv.split("\r\n")[0]));
});

test("html: self-contained, with no remote reference, link or script", () => {
  const html = buildMentorsHtml([entry({}, { avatar: "data:image/jpeg;base64,AAAA" })], {
    season: "2026秋季", exportedOn: "2026-10-12", copy,
  });
  assert.ok(!/<a[\s>]/i.test(html), "no anchors");
  assert.ok(!/<script/i.test(html), "no scripts");
  assert.ok(!/<link/i.test(html), "no stylesheets or fonts to fetch");
  assert.ok(!/@import|url\(\s*["']?https?:/i.test(html), "no CSS imports or remote urls");
  assert.ok(!/(src|href)=["']https?:/i.test(html), "no remote src/href");
  assert.ok(!html.includes("cdn.example.com"), "the remote avatar url is replaced by the inline image");
  assert.ok(html.includes('src="data:image/jpeg;base64,AAAA"'));
});

test("html: LinkedIn is plain text, not a link", () => {
  const html = buildMentorsHtml([entry()], { season: "S", exportedOn: "2026-10-12", copy });
  assert.ok(html.includes("https://linkedin.com/in/ann"));
  assert.ok(!/href=/i.test(html));
});

test("html: member text is escaped", () => {
  const html = buildMentorsHtml([entry({ full_name: "<b>x</b>", bio: '<img src=x onerror="alert(1)">' })], {
    season: "S", exportedOn: "2026-10-12", copy,
  });
  assert.ok(!html.includes("<b>x</b>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;b&gt;x&lt;/b&gt;"));
});

test("html: no avatar falls back to the name's initial", () => {
  const html = buildMentorsHtml([entry({ full_name: "ann" })], { season: "S", exportedOn: "d", copy });
  assert.ok(html.includes('class="avatar initial">A<'));
  assert.equal(initialOf("  小明"), "小");
  assert.equal(initialOf(""), "·");
  assert.equal(initialOf(null), "·");
});

test("html: a mentor block is kept whole across pages, and the footer carries the date and the notice", () => {
  const html = buildMentorsHtml([entry()], { season: "2026秋季", exportedOn: "2026-10-12", copy });
  assert.ok(/break-inside:\s*avoid/.test(html));
  assert.ok(html.includes("导出日期：2026-10-12"));
  assert.ok(html.includes("仅限本届 mentee 内部使用"));
  assert.ok(html.includes("2026秋季 导师信息"));
});

test("html: empty fields produce no row; the answer group is the header chip, not a row", () => {
  const html = buildMentorsHtml([entry({ bio: null, topics: "" })], { season: "S", exportedOn: "d", copy });
  assert.ok(!html.includes(`<dt>${copy.fields.bio}</dt>`));
  assert.ok(!html.includes(`<dt>${copy.fields.topics}</dt>`));
  assert.ok(html.includes(`<dt>${copy.fields.field}</dt>`));
  assert.ok(!html.includes(`<dt>${copy.fields.group}</dt>`));
  assert.ok(html.includes("答疑组：产品经理 组2"));
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

test("escapeHtml and the file name", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(exportFileName("2026 秋季", "2026-10-12", "csv"), "导师信息-2026秋季-20261012.csv");
});
