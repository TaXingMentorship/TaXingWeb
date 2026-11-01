// Pure logic behind 目录页「导出」: who may export, and the CSV. No React, no
// DOM and no runtime imports, so it can be unit-tested directly
// (tests/exportMentors.test.mjs).
//
// What is deliberately NOT here: email, wechat_number and admin_notes. The file
// is handed to mentees, so contact details never enter it (mentees have the
// portal for that).
import type { Profile } from "../../types/portal";
import type { portalCopy } from "../../data/portalCopy";

export type ExportCopy = typeof portalCopy.directoryExport;

export type MentorExportEntry = {
  profile: Profile;
  /** The mentor's Q&A answer group this season (migration 0028), if any. */
  groupName: string | null;
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

/**
 * One row per mentor, in ProfileDialog's field order. UTF-8 with a BOM (Excel
 * guesses a legacy code page without one and garbles Chinese) and CRLF line
 * ends. Every column is always present; a mentor's empty field is an empty
 * cell, so the columns stay aligned.
 */
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

/** A name safe to save under, e.g. 导师信息-2026秋季-20261012.csv */
export function exportFileName(season: string, exportedOn: string): string {
  const safe = season.replace(/[\\/:*?"<>|\s]+/g, "");
  return `导师信息-${safe}-${exportedOn.replace(/-/g, "")}.csv`;
}

/** The roster's filtered names, one per line under a single header. */
export function buildNamesCsv(names: string[], header: string): string {
  return BOM + [header, ...names].map(csvCell).join("\r\n") + "\r\n";
}

/** e.g. 名单-2026秋季-学员-感谢赠言已完成-20261101.csv */
export function namesFileName(season: string, label: string, exportedOn: string): string {
  const safe = (t: string) => t.replace(/[\\/:*?"<>|\s]+/g, "");
  const parts = ["名单", safe(season), safe(label)].filter(Boolean);
  return `${parts.join("-")}-${exportedOn.replace(/-/g, "")}.csv`;
}
