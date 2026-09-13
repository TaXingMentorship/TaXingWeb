import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const schema = z
  .object({
    id: z.uuid(),
    participant_role: z.enum(["mentor", "mentee"]).nullable(),
    is_admin: z.boolean(),
    is_volunteer: z.boolean(),
  })
  .refine(
    (identity) =>
      identity.participant_role || identity.is_admin || identity.is_volunteer,
    { message: "每位成员至少需要一种身份。" },
  );

/**
 * Changes who someone is.
 *
 * This is the most privileged write in the app — it is how admin is granted —
 * so it goes through the service-role client behind `requireApiRole("admin")`
 * rather than the browser client, even though `profiles_admin_write` would
 * technically allow the latter. `protect_profile_privileges` (migration 0004)
 * is the database's own backstop against a non-admin attempting it directly.
 */
export async function PATCH(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidBody(
      parsed.error.issues[0]?.message ?? "请提供有效的成员身份。",
    );
  }

  const supabase = createServiceRoleClient();
  const { id, ...identity } = parsed.data;

  // Removing the last admin would lock everyone out of every admin page, and
  // the only way back would be the SQL editor.
  if (!identity.is_admin) {
    const { count, error: countError } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("is_admin", true)
      .neq("id", id);
    if (countError) return databaseError("检查管理员数量", countError.message);
    if ((count ?? 0) === 0) {
      return invalidBody(
        "这是最后一位管理员，不能取消其管理员身份 —— 否则没有人能再进入管理页面。请先指定另一位管理员。",
      );
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(identity)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return databaseError("更新成员身份", error.message);

  return NextResponse.json(data);
}
