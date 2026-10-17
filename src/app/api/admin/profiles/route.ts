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
    if (countError) return databaseError("检查负责人数量", countError.message);
    if ((count ?? 0) === 0) {
      return invalidBody(
        "这是最后一位负责人，不能取消其负责人身份 —— 否则没有人能再进入管理页面。请先指定另一位负责人。",
      );
    }
  }

  const { data: before, error: beforeError } = await supabase
    .from("profiles")
    .select("participant_role, is_admin, is_volunteer")
    .eq("id", id)
    .single();
  if (beforeError) return databaseError("读取成员身份", beforeError.message);

  const { data, error } = await supabase
    .from("profiles")
    .update(identity)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return databaseError("更新成员身份", error.message);

  // Keep the person's invites in step with the identity just chosen. The
  // roster judges an invite against the account (`classifyInvites`), and an
  // invite that still says "mentor" for an account that no longer is one reads
  // as 身份不符 — the person drops out of the table and into 待激活 even though
  // they have long since activated. The admin's edit is the newer intent.
  //
  // Only what this edit changed is written: an invite can deliberately differ
  // from the account elsewhere (a volunteer imported as a mentee is flagged
  // 身份不符 on purpose), and an unrelated edit must not erase that. A role
  // change carries the whole identity, because an invite must keep at least
  // one identity (roster_invites_has_identity).
  const roleChanged = before.participant_role !== identity.participant_role;
  const inviteChanges = roleChanged
    ? identity
    : {
        ...(before.is_admin !== identity.is_admin && { is_admin: identity.is_admin }),
        ...(before.is_volunteer !== identity.is_volunteer && {
          is_volunteer: identity.is_volunteer,
        }),
      };
  if (Object.keys(inviteChanges).length === 0) return NextResponse.json(data);

  const claimed = await supabase
    .from("roster_invites")
    .update(inviteChanges)
    .eq("claimed_user_id", id);
  if (claimed.error) return databaseError("同步邀请身份", claimed.error.message);

  if (data.email) {
    const unclaimed = await supabase
      .from("roster_invites")
      .update(inviteChanges)
      .is("claimed_user_id", null)
      .ilike("email", data.email);
    if (unclaimed.error) {
      return databaseError("同步邀请身份", unclaimed.error.message);
    }
  }

  return NextResponse.json(data);
}
