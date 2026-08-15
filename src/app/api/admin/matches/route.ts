import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const schema = z.object({
  cohortId: z.uuid(),
  rows: z
    .array(
      z.object({
        mentor_id: z.uuid(),
        mentee_id: z.uuid(),
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
        ? `配对第 ${Number(issue.path[1] ?? 0) + 1} 行格式无效：成员 ID 必须为 UUID。`
        : "请选择有效项目并提交 1–1000 条配对。",
    );
  }

  const { data, error } = await createServiceRoleClient().rpc(
    "admin_import_matches",
    {
      p_cohort_id: parsed.data.cohortId,
      p_rows: parsed.data.rows,
    },
  );
  if (error) {
    if (error.message.includes("COHORT_NOT_FOUND")) {
      return invalidBody("所选项目不存在。");
    }
    const row = error.message.match(/ROW_(\d+)_(INVALID_MENTOR|INVALID_MENTEE)/);
    if (row) {
      return invalidBody(
        `配对第 ${row[1]} 行的${row[2] === "INVALID_MENTOR" ? "导师" : "学员"}不存在、身份不符或不属于该项目。`,
      );
    }
    return databaseError("导入配对", error.message);
  }

  return NextResponse.json(data);
}
