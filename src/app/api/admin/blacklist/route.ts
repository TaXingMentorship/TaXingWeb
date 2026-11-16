import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isBannedUser } from "@/lib/supabase/banned";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const schema = z.object({ profileId: z.uuid(), blacklisted: z.boolean() });
const BAN_DURATION = "876000h";

export async function GET() {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const { data, error } = await createServiceRoleClient()
    .from("member_blacklist")
    .select("profile_id");
  if (error) return databaseError("读取黑名单", error.message);
  return NextResponse.json(data.map((row) => row.profile_id));
}

export async function PATCH(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的成员和黑名单状态。");

  const { profileId, blacklisted } = parsed.data;
  if (profileId === actor.id) return invalidBody("不能将自己加入黑名单。");
  const service = createServiceRoleClient();
  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id,is_admin")
    .eq("id", profileId)
    .maybeSingle();
  if (profileError) return databaseError("检查成员", profileError.message);
  if (!profile) return invalidBody("找不到该成员。");
  if (blacklisted && profile.is_admin) return invalidBody("请先取消该成员的负责人身份，再加入黑名单。");

  const { data: existing, error: lookupError } = await service
    .from("member_blacklist")
    .select("profile_id")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (lookupError) return databaseError("检查黑名单", lookupError.message);
  if (!blacklisted && !existing) return invalidBody("该成员不在黑名单中。");

  const { data: authData, error: authLookupError } = await service.auth.admin.getUserById(profileId);
  if (authLookupError || !authData.user) {
    return databaseError("检查成员账号", authLookupError?.message);
  }
  const wasBanned = isBannedUser(authData.user);
  const { error: authError } = await service.auth.admin.updateUserById(profileId, {
    ban_duration: blacklisted ? BAN_DURATION : "none",
  });
  if (authError) return databaseError("更新账号封禁状态", authError.message);

  const { error: recordError } = await service.rpc("set_member_blacklist", {
    p_profile_id: profileId,
    p_actor_id: actor.id,
    p_blacklisted: blacklisted,
  });
  if (recordError) {
    // Keep an existing ban intact. If restoring the ban fails, surface the
    // mismatch explicitly rather than reporting a successful operation.
    const { error: rollbackError } = await service.auth.admin.updateUserById(profileId, {
      ban_duration: wasBanned ? BAN_DURATION : "none",
    });
    console.error("更新黑名单记录失败:", recordError.message, rollbackError?.message);
    return NextResponse.json(
      { error: rollbackError
        ? "黑名单记录更新失败，账号封禁状态也未能恢复，请立即联系技术负责人处理。"
        : "黑名单记录更新失败，账号封禁状态已恢复，请重试。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ blacklisted });
}
