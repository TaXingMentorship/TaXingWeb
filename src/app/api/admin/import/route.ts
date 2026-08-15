import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const schema = z.object({
  cohortId: z.uuid(),
  rows: z
    .array(
      z.object({
        email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
        full_name: z.string().trim().min(1).max(200),
        role: z.enum(["mentor", "mentee"]),
      }),
    )
    .min(1)
    .max(1000),
});

export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return invalidBody(
      issue?.path[0] === "rows"
        ? `名单第 ${Number(issue.path[1] ?? 0) + 1} 行格式无效：${issue.message}`
        : "请选择有效项目并提交 1–1000 行名单。",
    );
  }

  const { data, error } = await createServiceRoleClient().rpc(
    "admin_import_roster",
    {
      p_cohort_id: parsed.data.cohortId,
      p_rows: parsed.data.rows,
    },
  );
  if (error) {
    if (error.message.includes("COHORT_NOT_FOUND")) {
      return invalidBody("所选项目不存在。");
    }
    const row = error.message.match(/ROW_(\d+)_ROLE_CONFLICT/);
    if (row) return invalidBody(`名单第 ${row[1]} 行的邮箱存在身份冲突。`);
    return databaseError("导入名单", error.message);
  }

  return NextResponse.json(data);
}
