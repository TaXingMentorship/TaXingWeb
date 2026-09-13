import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../../_lib";

const schema = z.object({
  dryRun: z.boolean().default(false),
  rows: z
    .array(
      z.object({
        full_name: z.string().trim().min(1).max(200),
        email: z.string().trim().max(320).nullable(),
        wechat_number: z.string().trim().max(200).nullable(),
        notes: z.string().trim().max(2000).nullable(),
        is_public: z.boolean().nullable(),
        seasons: z
          .array(
            z.object({
              season: z.string().trim().min(1).max(200),
              group: z.string().trim().max(200).nullable(),
              is_lead: z.boolean().default(false),
            }),
          )
          .max(50),
      }),
    )
    .min(1)
    .max(2000),
});

type ImportError = {
  row: number;
  code: string;
  name?: string;
  value?: string;
  detail?: string;
};

/**
 * Every message names the offending row and the action that fixes it. The
 * import is all-or-nothing, so an admin reading this list is about to edit the
 * spreadsheet and upload it again — "格式无效" alone would not tell them what
 * to change.
 */
function describe(error: ImportError): string {
  const at = `第 ${error.row} 行`;
  const who = error.name ? `「${error.name}」` : "";

  switch (error.code) {
    case "INVALID_NAME":
      return `${at}：缺少姓名。请填写「姓名」列后重新导入。`;
    case "INVALID_EMAIL":
      return `${at}${who}：邮箱「${error.value}」格式不正确。请修正，或清空该单元格。`;
    case "NO_SEASON":
      return `${at}${who}：缺少季度。请在「季度」列填写至少一个季度，多个用分号隔开（例如「2025秋季;2026春季」）。`;
    case "UNKNOWN_SEASON":
      return `${at}${who}：季度「${error.value}」不存在。请在「季度管理」中先新建该季度，或改用已有季度的名称。`;
    case "UNKNOWN_GROUP":
      return `${at}${who}：组别「${error.value}」不存在。请在本页下方「组别管理」中先新建该组别，或改用已有组别的名称。`;
    case "FILE_DUP_EMAIL":
      return `${at}${who}：本文件中邮箱「${error.value}」被用在了姓名不同的多行上。请统一这些行的姓名，或给它们各自的邮箱。`;
    case "FILE_DUP_NAME":
      return `${at}${who}：本文件中姓名「${error.value}」出现在邮箱不同的多行上。如果是同一个人，请统一邮箱；如果是两个人，请给其中一位加上区分后缀。`;
    case "NAME_MISMATCH":
      return `${at}${who}：邮箱「${error.value}」已属于志愿者「${error.detail}」。请核对姓名是否写错，或删掉该行邮箱改用姓名匹配。`;
    case "LEAD_WITHOUT_GROUP":
      return `${at}${who}：「${error.value}」标记了负责人却没有写组别。负责人是某个组的负责人，请写成「${error.value}:运营组(负责人)」的形式。`;
    case "EMAIL_MISMATCH":
      return `${at}${who}：已有同名志愿者，但其邮箱是「${error.detail}」，与本行的「${error.value}」不一致。请核对后统一邮箱，或给这一位加上区分后缀。`;
    default:
      return `${at}${who}：数据有误（${error.code}），请检查后重新导入。`;
  }
}

export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return invalidBody(
      issue?.path[0] === "rows" && typeof issue.path[1] === "number"
        ? `名单第 ${issue.path[1] + 1} 行格式无效：${issue.message}`
        : "请提交 1–2000 行志愿者名单。",
    );
  }

  const { data, error } = await createServiceRoleClient().rpc(
    "admin_import_volunteers",
    { p_rows: parsed.data.rows, p_dry_run: parsed.data.dryRun },
  );
  if (error) {
    if (error.message.includes("EMPTY_IMPORT")) {
      return invalidBody("名单为空，请检查文件内容。");
    }
    return databaseError(parsed.data.dryRun ? "预检名单" : "导入名单", error.message);
  }

  const result = data as {
    ok: boolean;
    dry_run: boolean;
    errors: ImportError[];
    added: unknown[];
    updated: unknown[];
  };

  // The RPC reports codes; the Chinese wording lives here, next to the copy for
  // the rest of the admin surface.
  return NextResponse.json({
    ...result,
    errors: result.errors.map((issue) => ({ ...issue, message: describe(issue) })),
  });
}
