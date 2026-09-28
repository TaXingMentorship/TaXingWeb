"use client";

import Papa from "papaparse";
import type { MemberImportRow } from "@/lib/portal/store";

/**
 * Parses the unified member spreadsheet — one row per person, whether they need
 * a portal account, a place on the volunteer roster, or both.
 *
 * Everything about file formats and header spelling lives here; the RPC only
 * ever sees normalised rows.
 *
 * ExcelJS is ~1 MB and is loaded with a dynamic import at the moment a file is
 * chosen, so it never reaches the main bundle. CSV keeps using papaparse.
 */

/** Header aliases, lowercased. The first entry of each list is the canonical one. */
const HEADERS = {
  full_name: ["姓名", "名字", "昵称", "full_name", "name"],
  email: ["邮箱", "电子邮箱", "邮箱地址", "email", "e-mail", "mail"],
  identity: ["身份", "角色", "identity", "role", "participant_role"],
  seasons: ["季度", "参与季度", "seasons", "season", "participation"],
  group: ["组别", "分组", "志愿者小组", "group", "team"],
  wechat_number: ["微信", "微信号", "wechat", "wechat_number"],
  notes: ["备注", "notes", "note", "remark"],
  is_public: ["公开", "是否公开", "is_public", "public"],
  invite: ["开通门户", "邀请", "门户账号", "invite"],
} as const;

type Field = keyof typeof HEADERS;

export const REQUIRED_FIELDS: Field[] = ["full_name", "identity", "seasons"];

export const FIELD_LABELS: Record<Field, string> = {
  full_name: "姓名",
  email: "邮箱",
  identity: "身份",
  seasons: "季度",
  group: "组别",
  wechat_number: "微信",
  notes: "备注",
  is_public: "公开",
  invite: "开通门户",
};

export class MemberParseError extends Error {}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function mapColumns(header: string[]): Map<number, Field> {
  const lookup = new Map<string, Field>();
  for (const [field, aliases] of Object.entries(HEADERS) as [Field, readonly string[]][]) {
    for (const alias of aliases) lookup.set(normaliseHeader(alias), field);
  }

  const columns = new Map<number, Field>();
  header.forEach((cell, index) => {
    const field = lookup.get(normaliseHeader(cell ?? ""));
    if (field !== undefined && ![...columns.values()].includes(field)) {
      columns.set(index, field);
    }
  });

  const missing = REQUIRED_FIELDS.filter((f) => ![...columns.values()].includes(f));
  if (missing.length > 0) {
    throw new MemberParseError(
      `文件缺少必需的列：${missing.map((f) => FIELD_LABELS[f]).join("、")}。请下载模板对照表头后重试。`,
    );
  }
  return columns;
}

const TRUTHY = new Set(["true", "1", "yes", "y", "是", "公开", "需要", "开通"]);
const FALSY = new Set(["false", "0", "no", "n", "否", "不公开", "不需要"]);

function parseBoolean(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  return null;
}

type Identity = {
  participant_role: "mentor" | "mentee" | null;
  is_admin: boolean;
  is_volunteer: boolean;
};

const MENTOR = new Set(["导师", "mentor"]);
const MENTEE = new Set(["学员", "mentee"]);
// 「管理员」 is the old spelling; spreadsheets written before the rename still import.
const ADMIN = new Set(["负责人", "管理员", "admin"]);
const VOLUNTEER = new Set(["志愿者", "volunteer"]);

/**
 * The 身份 cell decides where the row lands, so it is read strictly: an
 * unrecognised word is an error rather than a silently ignored token. Getting
 * this wrong is how somebody ends up with — or without — a portal account.
 *
 * 导师 and 学员 are mutually exclusive because `participant_role` stores one
 * value; asking for both describes a state the database cannot hold.
 */
export function parseIdentity(cell: string): Identity {
  const tokens = cell
    .split(/[+＋、,，;；/／\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new MemberParseError("身份不能为空。可填写：导师、学员、志愿者、负责人，多个用「+」连接。");
  }

  const identity: Identity = { participant_role: null, is_admin: false, is_volunteer: false };
  for (const token of tokens) {
    if (MENTOR.has(token)) {
      if (identity.participant_role === "mentee") {
        throw new MemberParseError("同一个人不能既是导师又是学员。");
      }
      identity.participant_role = "mentor";
    } else if (MENTEE.has(token)) {
      if (identity.participant_role === "mentor") {
        throw new MemberParseError("同一个人不能既是导师又是学员。");
      }
      identity.participant_role = "mentee";
    } else if (ADMIN.has(token)) {
      identity.is_admin = true;
    } else if (VOLUNTEER.has(token)) {
      identity.is_volunteer = true;
    } else {
      throw new MemberParseError(
        `无法识别的身份「${token}」。可填写：导师、学员、志愿者、负责人，多个用「+」连接。`,
      );
    }
  }
  return identity;
}

/** Marks the group lead inside a season cell: 运营组(负责人), 运营组（负责人）, 运营组*. */
const LEAD_MARKER = /[（(]\s*(?:负责人|组长|lead)\s*[)）]\s*$|\*\s*$/i;

/**
 * 2026秋季;2027春季                    → both use the row's 组别 column
 * 2026秋季:运营组;2027春季:项目组       → per-season group
 * 2026秋季:运营组(负责人)               → lead of that group that season
 */
function parseSeasons(cell: string, rowGroup: string | null): MemberImportRow["seasons"] {
  return cell
    .split(/[;；,，、]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [season, rawGroup] = part.split(/[:：]/).map((piece) => piece.trim());
      const isLead = Boolean(rawGroup && LEAD_MARKER.test(rawGroup));
      const group = rawGroup ? rawGroup.replace(LEAD_MARKER, "").trim() : "";
      return { season, group: group || rowGroup, is_lead: isLead };
    })
    .filter((entry) => entry.season !== "");
}

function toRows(header: string[], body: string[][]): MemberImportRow[] {
  const columns = mapColumns(header);
  const read = (cells: string[], field: Field): string => {
    for (const [index, mapped] of columns) {
      if (mapped === field) return (cells[index] ?? "").trim();
    }
    return "";
  };

  return body
    .filter((cells) => cells.some((cell) => (cell ?? "").trim() !== ""))
    .map((cells, index) => {
      let identity: Identity;
      try {
        identity = parseIdentity(read(cells, "identity"));
      } catch (error) {
        throw new MemberParseError(
          `第 ${index + 1} 行：${error instanceof Error ? error.message : String(error)}`,
        );
      }

      const rowGroup = read(cells, "group") || null;
      const seasons = parseSeasons(read(cells, "seasons"), rowGroup);
      // A group or a lead mark only makes sense for a volunteer, and the RPC
      // rejects the combination — surface it as a volunteer identity here so
      // the admin does not have to write 志愿者 twice.
      const hasGroupWork = seasons.some((s) => s.group || s.is_lead);
      const explicitInvite = parseBoolean(read(cells, "invite"));

      return {
        full_name: read(cells, "full_name"),
        email: read(cells, "email") || null,
        wechat_number: read(cells, "wechat_number") || null,
        notes: read(cells, "notes") || null,
        is_public: parseBoolean(read(cells, "is_public")),
        participant_role: identity.participant_role,
        is_admin: identity.is_admin,
        is_volunteer: identity.is_volunteer || hasGroupWork,
        /**
         * Portal-only identities imply an account — a 导师 row with no
         * invitation would do nothing at all. A volunteer-only row does not:
         * their email is contact information until 开通门户 says otherwise, so
         * recording someone's address never quietly grants them access.
         */
        invite:
          explicitInvite ??
          Boolean(
            read(cells, "email") &&
              (identity.participant_role || identity.is_admin),
          ),
        seasons,
      };
    });
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const cell = value as {
      text?: unknown;
      result?: unknown;
      richText?: { text: string }[];
    };
    if (Array.isArray(cell.richText)) return cell.richText.map((p) => p.text).join("");
    if (typeof cell.text === "string") return cell.text;
    if (cell.result !== undefined) return cellToText(cell.result);
  }
  return String(value);
}

async function parseXlsx(file: File): Promise<MemberImportRow[]> {
  // ExcelJS is CommonJS; unwrapping `default` when present works under both
  // webpack and plain ESM, while destructuring `{ Workbook }` does not.
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new MemberParseError("这个 Excel 文件里没有工作表。");

  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // `values` is 1-based with a leading hole, so index 0 is dropped.
    (row.values as unknown[]).slice(1).forEach((value, index) => {
      cells[index] = cellToText(value);
    });
    table.push(cells);
  });

  const [header, ...body] = table;
  if (!header) throw new MemberParseError("这个 Excel 文件是空的。");
  return toRows(header, body);
}

function parseCsv(file: File): Promise<MemberImportRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const [header, ...body] = result.data;
        if (!header) {
          reject(new MemberParseError("这个 CSV 文件是空的。"));
          return;
        }
        try {
          resolve(toRows(header, body));
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(new MemberParseError(`解析失败：${error.message}`)),
    });
  });
}

export async function parseMemberFile(file: File): Promise<MemberImportRow[]> {
  const rows = file.name.toLowerCase().endsWith(".csv")
    ? await parseCsv(file)
    : await parseXlsx(file);
  if (rows.length === 0) {
    throw new MemberParseError("文件里没有数据行，请检查后重试。");
  }
  return rows;
}

/** Header row plus worked examples covering each routing case. */
export function memberTemplateCsv(): string {
  const header = ["姓名", "邮箱", "身份", "季度", "组别", "微信", "备注", "开通门户"];
  const examples = [
    ["示例·导师", "mentor@example.com", "导师", "2026秋季", "", "", "只发门户邀请", ""],
    ["示例·学员", "mentee@example.com", "学员", "2026秋季", "", "", "只发门户邀请", ""],
    ["示例·志愿者", "vol@example.com", "志愿者", "2026秋季", "运营组", "wx_id", "记入名册；开通门户填「是」才发账号", "是"],
    ["示例·历史志愿者", "", "志愿者", "2024春季", "项目组", "", "没有邮箱，只记入名册", ""],
    ["示例·负责人", "lead@example.com", "导师+志愿者", "2026秋季:运营组(负责人)", "", "", "既是导师又是志愿者，且带运营组", "是"],
  ];
  // The BOM makes Excel on Windows read the file as UTF-8 instead of GBK.
  return `﻿${[header, ...examples].map((r) => r.join(",")).join("\r\n")}\r\n`;
}
