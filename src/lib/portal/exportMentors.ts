// Pure logic behind 目录页「导出导师信息」: who may export, which fields a
// mentor contributes, and the two files (CSV, and a self-contained printable
// page that becomes the PDF). No React, no DOM and no runtime imports, so it can
// be unit-tested directly (tests/exportMentors.test.mjs).
//
// What is deliberately NOT here: email, wechat_number and admin_notes. The file
// is handed to mentees, so contact details never enter it (mentees have the
// portal for that). LinkedIn is text only in the printable page (offline links
// go nowhere) and kept as a column in the CSV.
import type { Profile } from "../../types/portal";
import type { portalCopy } from "../../data/portalCopy";

export type ExportCopy = typeof portalCopy.directoryExport;

export type MentorExportEntry = {
  profile: Profile;
  /** The mentor's Q&A answer group this season (migration 0028), if any. */
  groupName: string | null;
  /** The avatar as a data: URL, or null when it could not be fetched. */
  avatar: string | null;
};

/**
 * Admins, and volunteers *of the season shown*. Not `profiles.is_volunteer`: it
 * is one flag with no season, so it would let past volunteers in. The caller
 * passes the season's volunteer ids (the roster's `volunteer_seasons`), and the
 * user's own id is looked up directly, because their own profile need not be in
 * the visible list.
 */
export function canExportMentors(input: {
  isAdmin: boolean;
  userId: string | null | undefined;
  seasonVolunteerIds: ReadonlySet<string>;
}): boolean {
  if (input.isAdmin) return true;
  return Boolean(input.userId) && input.seasonVolunteerIds.has(input.userId as string);
}

const present = (value: string | null | undefined): value is string =>
  typeof value === "string" && value.trim() !== "";

export type ExportField = { key: keyof ExportCopy["fields"]; label: string; value: string };

/**
 * The fields of one mentor that have something in them, in ProfileDialog's
 * order. An empty field is left out, not shown as a blank line. `linkedin` is
 * returned only when asked for (CSV); the printable page leaves it out of the
 * fields and prints it as plain text itself.
 */
export function mentorFields(
  entry: MentorExportEntry,
  copy: ExportCopy,
  options: { linkedin: boolean },
): ExportField[] {
  const { profile: p, groupName } = entry;
  const f = copy.fields;
  const candidates: [ExportField["key"], string | null | undefined][] = [
    ["field", p.field],
    ["bio", p.bio],
    ["background", p.background],
    ["yearsExperience", p.years_experience],
    ["menteeCapacity", p.mentee_capacity],
    ["menteeExpectations", p.mentee_expectations],
    ["topics", p.topics],
    ["interests", p.interests.filter(present).join("、")],
    ["group", groupName],
  ];
  if (options.linkedin) candidates.push(["linkedin", p.linkedin]);
  return candidates
    .filter(([, value]) => present(value))
    .map(([key, value]) => ({ key, label: f[key], value: (value as string).trim() }));
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * One CSV cell. Quoted when it holds a comma, quote, line break or edge space;
 * quotes are doubled. A cell that would start with = + - @ is prefixed with an
 * apostrophe: opened in Excel it would otherwise run as a formula, and this text
 * is written by members, not by us.
 */
export function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const BOM = "﻿";

/** UTF-8 with a BOM (Excel guesses a legacy code page without one and garbles
 *  Chinese) and CRLF line ends. Every column is always present; a mentor's
 *  empty field is an empty cell. */
export function buildMentorsCsv(entries: MentorExportEntry[], copy: ExportCopy): string {
  const f = copy.fields;
  const columns: [string, (e: MentorExportEntry) => string | null | undefined][] = [
    [f.name, (e) => e.profile.full_name],
    [f.field, (e) => e.profile.field],
    [f.bio, (e) => e.profile.bio],
    [f.background, (e) => e.profile.background],
    [f.yearsExperience, (e) => e.profile.years_experience],
    [f.menteeCapacity, (e) => e.profile.mentee_capacity],
    [f.menteeExpectations, (e) => e.profile.mentee_expectations],
    [f.topics, (e) => e.profile.topics],
    [f.interests, (e) => e.profile.interests.filter(present).join("、")],
    [f.group, (e) => e.groupName],
    [f.linkedin, (e) => e.profile.linkedin],
  ];
  const lines = [
    columns.map(([header]) => csvCell(header)).join(","),
    ...entries.map((entry) =>
      columns.map(([, read]) => csvCell((read(entry) ?? "").trim())).join(","),
    ),
  ];
  return BOM + lines.join("\r\n") + "\r\n";
}

// ---------------------------------------------------------------------------
// Printable page (the PDF)
// ---------------------------------------------------------------------------

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** First visible character of a name, for the avatar placeholder. */
export function initialOf(name: string | null | undefined): string {
  const first = Array.from((name ?? "").trim())[0];
  return first ? first.toUpperCase() : "·";
}

// System CJK fonts only, in the order each platform ships them. Nothing is
// fetched: the page must read with no network. Printing to PDF embeds whichever
// font the browser used into the PDF itself.
const FONT_STACK =
  '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Micro Hei",sans-serif';

const STYLE = `
  @page { size: A4; margin: 16mm 14mm 20mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #222; font: 11pt/1.6 ${FONT_STACK}; }
  h1 { margin: 0 0 2pt; font-size: 20pt; }
  .meta { margin: 0 0 14pt; color: #666; font-size: 10pt; }
  .mentor { margin: 0 0 12pt; padding: 10pt 12pt; border: 1px solid #ddd; border-radius: 8pt;
            break-inside: avoid; page-break-inside: avoid; }
  .head { display: flex; align-items: center; gap: 10pt; margin-bottom: 6pt; }
  .avatar { flex: none; width: 44pt; height: 44pt; border-radius: 50%; object-fit: cover; }
  .initial { display: flex; align-items: center; justify-content: center; background: #e8e2d6;
             color: #6b5a3a; font-size: 18pt; font-weight: 700; }
  .name { font-size: 14pt; font-weight: 700; }
  .group { margin-left: 8pt; padding: 1pt 7pt; border: 1px solid #2e7d32; border-radius: 10pt;
           color: #2e7d32; font-size: 9pt; font-weight: 400; white-space: nowrap; }
  dl { margin: 0; }
  dt { margin-top: 5pt; color: #777; font-size: 9pt; }
  dd { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .footer { position: fixed; left: 0; right: 0; bottom: 0; text-align: center; color: #888; font-size: 9pt; }
  @media screen {
    body { max-width: 760px; margin: 0 auto; padding: 24px 16px 32px; }
    .footer { position: static; margin-top: 24px; }
  }
`;

function mentorBlock(entry: MentorExportEntry, copy: ExportCopy): string {
  const { profile: p, avatar } = entry;
  const name = escapeHtml(p.full_name ?? "");
  const picture = avatar
    ? `<img class="avatar" src="${avatar}" alt="">`
    : `<div class="avatar initial">${escapeHtml(initialOf(p.full_name))}</div>`;
  // The answer group is the header's chip, as in ProfileDialog, so it is not
  // repeated as a row.
  const rows = mentorFields(entry, copy, { linkedin: false })
    .filter((field) => field.key !== "group")
    .map((field) => `<dt>${escapeHtml(field.label)}</dt><dd>${escapeHtml(field.value)}</dd>`);
  // LinkedIn is text, not a link: offline a link goes nowhere.
  if (present(p.linkedin)) {
    rows.push(`<dt>${escapeHtml(copy.fields.linkedin)}</dt><dd>${escapeHtml(p.linkedin.trim())}</dd>`);
  }
  const group = present(entry.groupName)
    ? `<span class="group">${escapeHtml(copy.fields.group)}：${escapeHtml(entry.groupName.trim())}</span>`
    : "";
  return `<section class="mentor"><div class="head">${picture}<div class="name">${name}${group}</div></div><dl>${rows.join("")}</dl></section>`;
}

/**
 * One self-contained HTML document: styles inline, avatars as data: URLs, system
 * fonts, no links, scripts or remote references. Each mentor is one block that
 * the browser is told not to split across pages; the footer repeats on every
 * printed page.
 */
export function buildMentorsHtml(
  entries: MentorExportEntry[],
  options: { season: string; exportedOn: string; copy: ExportCopy },
): string {
  const { season, exportedOn, copy } = options;
  const title = escapeHtml(copy.title(season));
  return [
    "<!doctype html>",
    '<html lang="zh-CN"><head><meta charset="utf-8">',
    `<title>${title}</title>`,
    `<style>${STYLE}</style></head><body>`,
    `<h1>${title}</h1>`,
    `<p class="meta">${escapeHtml(copy.mentorCount(entries.length))}</p>`,
    ...entries.map((entry) => mentorBlock(entry, copy)),
    `<div class="footer">${escapeHtml(copy.footer(exportedOn))}</div>`,
    "</body></html>",
  ].join("\n");
}

/** A name safe to save under, e.g. 导师信息-2026秋季-20261012.csv */
export function exportFileName(season: string, exportedOn: string, extension: string): string {
  const safe = season.replace(/[\\/:*?"<>|\s]+/g, "");
  return `导师信息-${safe}-${exportedOn.replace(/-/g, "")}.${extension}`;
}
