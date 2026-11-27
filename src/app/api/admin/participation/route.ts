import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody } from "../_lib";

// Mentee activity records edited by a season's progress managers (0058):
// admins, group leads and 人事组 members of the record's season. Mentees edit
// their own records through the browser client under RLS instead.

const updateSchema = z.object({
  id: z.uuid(),
  event_name: z.string().trim().min(1).max(200),
});
const deleteSchema = z.object({ id: z.uuid() });

async function loadAuthorized(id: string) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (!user.profile) {
    return NextResponse.json({ error: "没有权限执行此操作。" }, { status: 403 });
  }
  const forbidden = () =>
    NextResponse.json({ error: "没有权限管理该活动记录。" }, { status: 403 });

  const service = createServiceRoleClient();
  const { data: record, error: readError } = await service
    .from("participation_records")
    .select("id, cohort_id, mentee_id, screenshot_path")
    .eq("id", id)
    .maybeSingle();
  if (readError) return databaseError("读取活动记录", readError.message);
  // Same answer for a missing record and a forbidden one, so non-managers
  // cannot probe which ids exist.
  if (!record) return forbidden();

  const client = await createClient();
  const { data: allowed, error } = await client.rpc("can_manage_season_progress", {
    p_cohort_id: record.cohort_id,
  });
  if (error) return databaseError("验证进度管理权限", error.message);
  if (allowed !== true) return forbidden();
  return { service, record };
}

export async function PATCH(request: Request) {
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请填写活动名称。");

  const loaded = await loadAuthorized(parsed.data.id);
  if (loaded instanceof NextResponse) return loaded;

  const { data, error } = await loaded.service
    .from("participation_records")
    .update({ event_name: parsed.data.event_name })
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error) return databaseError("更新活动记录", error.message);
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("活动记录 ID 无效。");

  const loaded = await loadAuthorized(parsed.data.id);
  if (loaded instanceof NextResponse) return loaded;

  // Row first: if it fails, the record and its screenshot both stay intact.
  const { error } = await loaded.service
    .from("participation_records")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return databaseError("删除活动记录", error.message);

  // Only ever remove an object in the mentee's own folder (0059 enforces this
  // for new paths; older rows are checked here too). A failure leaves an
  // orphaned object, not a broken record.
  const path = loaded.record.screenshot_path;
  if (path && path.startsWith(`${loaded.record.mentee_id}/`)) {
    const { error: storageError } = await loaded.service.storage
      .from("participation")
      .remove([path]);
    if (storageError) console.error(`删除活动截图: ${storageError.message}`);
  } else if (path) {
    console.error(`删除活动截图: skipped path outside mentee folder (${parsed.data.id})`);
  }
  return new NextResponse(null, { status: 204 });
}
