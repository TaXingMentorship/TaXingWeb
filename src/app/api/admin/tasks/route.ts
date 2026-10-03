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
  due_on: z.iso.date({ message: "请选择截止日期。" }),
  cohort_id: z.uuid().nullable(),
  audience_roles: z.array(z.enum(["mentor", "mentee"])).max(2).default([]),
  audience_volunteers: z.boolean().default(false),
  audience_group_id: z.uuid().nullable().default(null),
  volunteer_ids: z.array(z.uuid()).max(500).default([]),
  profile_ids: z.array(z.uuid()).max(500).default([]),
})
  .refine(
    (input) =>
      input.volunteer_ids.length +
        input.profile_ids.length +
        input.audience_roles.length +
        (input.audience_volunteers ? 1 : 0) >
      0,
    { message: "请至少选择一位接收人。" },
  )
  .refine((input) => input.audience_group_id === null || input.audience_volunteers, {
    message: "组别范围必须同时选择志愿者。",
  })
  .refine(
    (input) =>
      (input.audience_roles.length === 0 && !input.audience_volunteers) ||
      input.cohort_id !== null,
    { message: "动态接收范围必须选择季度。" },
  )
  .refine(
    (input) =>
      (input.audience_roles.length === 0 && !input.audience_volunteers) ||
      (input.volunteer_ids.length === 0 && input.profile_ids.length === 0),
    { message: "动态接收范围不能同时指定固定接收人。" },
  );

const deleteSchema = z.object({ id: z.uuid() });

/**
 * Creates the task and its recipients together. The recipient list arrives
 * Fixed recipient lists arrive already expanded. Dynamic mentor/mentee and
 * season-wide volunteer audiences are persisted on the task and assigned by database triggers.
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
  const { volunteer_ids, profile_ids, ...task } = parsed.data;
  const volunteerIds = Array.from(new Set(volunteer_ids));

  // Someone who is both a volunteer and a mentor can be picked twice — once
  // by record, once by account. One assignment per person: the volunteer row
  // wins, since it resolves to the same account.
  const linked = new Set<string>();
  if (volunteerIds.length > 0) {
    const { data: rows, error: linkError } = await supabase
      .from("volunteers")
      .select("profile_id")
      .in("id", volunteerIds)
      .not("profile_id", "is", null);
    if (linkError) return databaseError("读取志愿者", linkError.message);
    for (const row of rows ?? []) if (row.profile_id) linked.add(row.profile_id);
  }
  const profileIds = Array.from(new Set(profile_ids)).filter((id) => !linked.has(id));
  const recipients = [
    ...volunteerIds.map((volunteer_id) => ({ volunteer_id, profile_id: null })),
    ...profileIds.map((profile_id) => ({ volunteer_id: null, profile_id })),
  ];

  const { data: created, error } = await supabase
    .from("tasks")
    .insert({ ...task, created_by: actor.id })
    .select("id")
    .single();
  if (error) return databaseError("创建任务", error.message);

  if (recipients.length > 0) {
    const { error: assignError } = await supabase
      .from("task_assignments")
      .insert(recipients.map((recipient) => ({ task_id: created.id, ...recipient })));
    if (assignError) {
      // No partial task: a fixed-recipient task with nobody to do it is not
      // worth keeping. Dynamic assignments created by the task trigger cascade.
      await supabase.from("tasks").delete().eq("id", created.id);
      return databaseError("分配任务", assignError.message);
    }
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
