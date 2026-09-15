import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

// Links stay inside the portal: a reminder must never send someone off-site.
const portalPath = z
  .string()
  .trim()
  .regex(/^\/portal(\/[^\s]*)?$/, "链接必须是门户内的路径，例如 /portal/me。");

const createSchema = z.object({
  title: z.string().trim().min(1, "请填写任务标题。").max(200),
  description: z.string().trim().max(2000).nullable(),
  link: portalPath.nullable(),
  due_on: z.iso.date().nullable(),
  cohort_id: z.uuid().nullable(),
  volunteer_ids: z.array(z.uuid()).min(1, "请至少选择一位接收人。").max(500),
});

const deleteSchema = z.object({ id: z.uuid() });

/**
 * Creates the task and its recipients together. The recipient list arrives
 * already expanded — the admin page resolves "整组" / "全季度" from the roster
 * it has loaded, and the preview it shows is exactly what is posted.
 */
export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidBody(
      `任务信息无效：${parsed.error.issues[0]?.message ?? "请检查必填项。"}`,
    );
  }

  const supabase = createServiceRoleClient();
  const { volunteer_ids, ...task } = parsed.data;
  const recipients = Array.from(new Set(volunteer_ids));

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({ ...task, created_by: actor.id })
    .select("id")
    .single();
  if (error) return databaseError("创建任务", error.message);

  const { error: assignError } = await supabase
    .from("task_assignments")
    .insert(recipients.map((volunteer_id) => ({ task_id: created.id, volunteer_id })));
  if (assignError) {
    // No partial task: a task with nobody to do it is not worth keeping.
    await supabase.from("tasks").delete().eq("id", created.id);
    return databaseError("分配任务", assignError.message);
  }

  const { data, error: readError } = await supabase
    .from("tasks")
    .select("*, assignments:task_assignments(*)")
    .eq("id", created.id)
    .single();
  if (readError) return databaseError("读取任务", readError.message);

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("任务 id 无效。");

  const { error } = await createServiceRoleClient()
    .from("tasks")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return databaseError("删除任务", error.message);

  return NextResponse.json({ id: parsed.data.id });
}
