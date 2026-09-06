"use client";

import Papa from "papaparse";
import type { VolunteerImportRow } from "@/lib/portal/store";

/**
 * Parses the volunteer roster spreadsheet into the row shape
 * `admin_import_volunteers` validates. Everything about file formats and
 * header spelling lives here; the RPC only ever sees normalised rows.
 *
 * ExcelJS is ~1 MB and is loaded with a dynamic import at the moment a file is
 * chosen, so it never reaches the main bundle. CSV keeps using papaparse, which
 * the roster import already depends on.
 */

/** Header aliases, lowercased. The first entry of each list is the canonical one. */
const HEADERS = {
  full_name: ["姓名", "名字", "full_name", "name"],
  email: ["邮箱", "电子邮箱", "email", "e-mail", "mail"],
  wechat_number: ["微信", "微信号", "wechat", "wechat_number"],
  seasons: ["季度", "参与季度", "seasons", "season", "participation"],
  group: ["组别", "分组", "group", "team"],
  notes: ["备注", "notes", "note", "remark"],
  is_public: ["公开", "是否公开", "is_public", "public"],
} as const;

type Field = keyof typeof HEADERS;

export const REQUIRED_FIELDS: Field[] = ["full_name", "seasons"];

export const FIELD_LABELS: Record<Field, string> = {
  full_name: "姓名",
  email: "邮箱",
  wechat_number: "微信",
  seasons: "季度",
  group: "组别",
  notes: "备注",
  is_public: "公开",
};

export class VolunteerParseError extends Error {}

function normaliseHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

/** Maps each column index to the field it holds; unknown columns are ignored. */
function mapColumns(header: string[]): Map<number, Field> {
  const lookup = new Map<string, Field>();
  for (const [field, aliases] of Object.entries(HEADERS) as [
    Field,
    readonly string[],
  ][]) {
    for (const alias of aliases) lookup.set(normaliseHeader(alias), field);
  }

  const columns = new Map<number, Field>();
  header.forEach((cell, index) => {
    const field = lookup.get(normaliseHeader(cell ?? ""));
    if (field !== undefined && ![...columns.values()].includes(field)) {
      columns.set(index, field);
    }
  });

  const missing = REQUIRED_FIELDS.filter(
    (field) => ![...columns.values()].includes(field),
  );
  if (missing.length > 0) {
    throw new VolunteerParseError(
      `文件缺少必需的列：${missing
        .map((field) => FIELD_LABELS[field])
        .join("、")}。请下载模板对照表头后重试。`,
    );
  }

  return columns;
}

const TRUTHY = new Set(["true", "1", "yes", "y", "是", "公开"]);
const FALSY = new Set(["false", "0", "no", "n", "否", "不公开"]);

function parseIsPublic(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "") return null;
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return null;
}

/** Marks the group lead inside a season cell: 运营组(负责人), 运营组（负责人）, 运营组*. */
const LEAD_MARKER = /[（(]\s*(?:负责人|组长|lead)\s*[)）]\s*$|\*\s*$/i;

/**
 * The seasons cell accepts these forms:
 *
 *   2025秋季;2026春季                    → both use the row's 组别 column
 *   2025秋季:运营组;2026春季:项目组       → per-season group, overriding it
 *   2026春季:运营组(负责人)               → lead of that group that season
 *
 * The lead marker lives inside the season cell rather than in its own column
 * because leadership is per season, exactly like the group: a column could only
 * ever say "is a lead", never "led 运营组 in 2026春季".
 *
 * Separators are deliberately loose (；;，, and : ：) because the file is typed
 * by hand in Excel and a full-width colon is the likely default on a Chinese
 * keyboard.
 */
function parseSeasons(
  cell: string,
  rowGroup: string | null,
): VolunteerImportRow["seasons"] {
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

function toRows(header: string[], body: string[][]): VolunteerImportRow[] {
  const columns = mapColumns(header);

  const read = (cells: string[], field: Field): string => {
    for (const [index, mapped] of columns) {
      if (mapped === field) return (cells[index] ?? "").trim();
    }
    return "";
  };

  return body
    .filter((cells) => cells.some((cell) => (cell ?? "").trim() !== ""))
    .map((cells) => {
      const rowGroup = read(cells, "group") || null;
      return {
        full_name: read(cells, "full_name"),
        email: read(cells, "email") || null,
        wechat_number: read(cells, "wechat_number") || null,
        notes: read(cells, "notes") || null,
        is_public: parseIsPublic(read(cells, "is_public")),
        seasons: parseSeasons(read(cells, "seasons"), rowGroup),
      };
    });
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    // ExcelJS returns objects for hyperlinks, rich text and formula results.
    const cell = value as {
      text?: unknown;
      result?: unknown;
      richText?: { text: string }[];
      hyperlink?: string;
    };
    if (Array.isArray(cell.richText)) {
      return cell.richText.map((part) => part.text).join("");
    }
    if (typeof cell.text === "string") return cell.text;
    if (cell.result !== undefined) return cellToText(cell.result);
  }
  return String(value);
}

async function parseXlsx(file: File): Promise<VolunteerImportRow[]> {
  // ExcelJS is CommonJS, so whether the named export survives depends on the
  // bundler's interop. Unwrapping `default` when it is there works under both
  // webpack and plain ESM; destructuring `{ Workbook }` does not.
  const imported = await import("exceljs");
  const ExcelJS = imported.default ?? imported;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new VolunteerParseError("这个 Excel 文件里没有工作表。");

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
  if (!header) throw new VolunteerParseError("这个 Excel 文件是空的。");
  return toRows(header, body);
}

function parseCsv(file: File): Promise<VolunteerImportRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        const [header, ...body] = result.data;
        if (!header) {
          reject(new VolunteerParseError("这个 CSV 文件是空的。"));
          return;
        }
        try {
          resolve(toRows(header, body));
        } catch (error) {
          reject(error);
        }
      },
      error: (error) =>
        reject(new VolunteerParseError(`解析失败：${error.message}`)),
    });
  });
}

export async function parseVolunteerFile(
  file: File,
): Promise<VolunteerImportRow[]> {
  const rows = file.name.toLowerCase().endsWith(".csv")
    ? await parseCsv(file)
    : await parseXlsx(file);

  if (rows.length === 0) {
    throw new VolunteerParseError("文件里没有数据行，请检查后重试。");
  }
  return rows;
}

/** Header row plus two filled-in examples, written as a CSV the user can open in Excel. */
export function volunteerTemplateCsv(): string {
  const header = ["姓名", "邮箱", "微信", "季度", "组别", "备注", "公开"];
  const examples = [
    ["示例·小鱼", "xiaoyu@example.com", "xiaoyu_wx", "2025秋季;2026春季", "运营组", "", "是"],
    ["示例·小满", "", "", "2025秋季:项目组(负责人);2026春季:战略组", "", "负责人会自动进入战略组", "是"],
  ];
  // The BOM makes Excel on Windows read the file as UTF-8 instead of GBK.
  return `﻿${[header, ...examples].map((row) => row.join(",")).join("\r\n")}\r\n`;
}
