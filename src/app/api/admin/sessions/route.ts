import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Profile, SessionLog } from "@/types/portal";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });
const fieldsSchema = z.object({
  cohort_id: z.uuid(),
  mentor_id: z.uuid(),
  mentee_id: z.uuid(),
  session_type: z.enum(["mentorship", "gratitude"]),
  session_date: dateSchema,
  notes: z.string().trim().max(5000).nullable(),
  created_by: z.uuid().nullable().optional(),
});
const updateSchema = z.object({
  id: z.uuid(),
  patch: fieldsSchema
    .omit({ cohort_id: true, created_by: true })
    .partial()
    .refine((patch) => Object.keys(patch).length > 0),
});
const deleteSchema = z.object({ id: z.uuid() });

type ServiceClient = ReturnType<typeof createServiceRoleClient>;
type Actor = Awaited<ReturnType<typeof requireApiRole>>;

async function validateParticipants(
  service: ServiceClient,
  actor: Exclude<Actor, NextResponse>,
  session: Omit<SessionLog, "id" | "created_at">,
) {
  const [{ data: cohort }, { data: people, error }] = await Promise.all([
    service.from("cohorts").select("id").eq("id", session.cohort_id).maybeSingle(),
    service
      .from("profiles")
      .select("id, participant_role, cohort_ids")
      .in("id", [session.mentor_id, session.mentee_id]),
  ]);
  if (!cohort) return "所选项目不存在。";
  if (error || people?.length !== 2) return "导师或学员不存在。";

  const mentor = people.find((person) => person.id === session.mentor_id) as
    | Pick<Profile, "id" | "participant_role" | "cohort_ids">
    | undefined;
  const mentee = people.find((person) => person.id === session.mentee_id) as
    | Pick<Profile, "id" | "participant_role" | "cohort_ids">
    | undefined;
  if (
    mentor?.participant_role !== "mentor" ||
    mentee?.participant_role !== "mentee"
  ) {
    return "配对成员身份不正确。";
  }
  if (
    !mentor.cohort_ids.includes(session.cohort_id) ||
    !mentee.cohort_ids.includes(session.cohort_id)
  ) {
    return "导师和学员必须属于所选项目。";
  }

  if (!actor.profile.is_admin && actor.profile.participant_role === "mentor") {
    if (session.mentor_id !== actor.id) return "导师只能管理自己的交流记录。";
    const { data: match } = await service
      .from("matches")
      .select("id")
      .eq("cohort_id", session.cohort_id)
      .eq("mentor_id", actor.id)
      .eq("mentee_id", session.mentee_id)
      .maybeSingle();
    if (!match) return "只能为已配对的学员记录交流。";
  }
  return null;
}

export async function POST(request: Request) {
  const actor = await requireApiRole(["admin", "mentor"]);
  if (actor instanceof NextResponse) return actor;

  const parsed = fieldsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请检查项目、成员、日期、类型和备注。");

  const service = createServiceRoleClient();
  const input = {
    ...parsed.data,
    mentor_id:
      !actor.profile.is_admin && actor.profile.participant_role === "mentor"
        ? actor.id
        : parsed.data.mentor_id,
    created_by: actor.id,
  };
  const validationError = await validateParticipants(service, actor, input);
  if (validationError) return invalidBody(validationError);

  const { data, error } = await service
    .from("sessions_log")
    .insert(input)
    .select("*")
    .single();
  if (error) return databaseError("新增交流记录", error.message);
  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const actor = await requireApiRole(["admin", "mentor"]);
  if (actor instanceof NextResponse) return actor;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("交流记录 ID 或更新内容无效。");

  const service = createServiceRoleClient();
  const { data: current, error: readError } = await service
    .from("sessions_log")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError) return databaseError("读取交流记录", readError.message);
  if (!current) {
    return NextResponse.json({ error: "找不到该交流记录。" }, { status: 404 });
  }
  if (
    !actor.profile.is_admin &&
    actor.profile.participant_role === "mentor" &&
    current.mentor_id !== actor.id
  ) {
    return NextResponse.json({ error: "没有权限修改该记录。" }, { status: 403 });
  }

  const next = {
    ...current,
    ...parsed.data.patch,
    mentor_id:
      !actor.profile.is_admin && actor.profile.participant_role === "mentor"
        ? actor.id
        : parsed.data.patch.mentor_id ?? current.mentor_id,
  } as SessionLog;
  const validationError = await validateParticipants(service, actor, next);
  if (validationError) return invalidBody(validationError);

  const update =
    !actor.profile.is_admin && actor.profile.participant_role === "mentor"
      ? { ...parsed.data.patch, mentor_id: actor.id }
      : parsed.data.patch;
  const { data, error } = await service
    .from("sessions_log")
    .update(update)
    .eq("id", parsed.data.id)
    .select("*")
    .single();
  if (error) return databaseError("更新交流记录", error.message);
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const actor = await requireApiRole(["admin", "mentor"]);
  if (actor instanceof NextResponse) return actor;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("交流记录 ID 无效。");

  const service = createServiceRoleClient();
  const { data: current, error: readError } = await service
    .from("sessions_log")
    .select("mentor_id")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (readError) return databaseError("读取交流记录", readError.message);
  if (!current) {
    return NextResponse.json({ error: "找不到该交流记录。" }, { status: 404 });
  }
  if (
    !actor.profile.is_admin &&
    actor.profile.participant_role === "mentor" &&
    current.mentor_id !== actor.id
  ) {
    return NextResponse.json({ error: "没有权限删除该记录。" }, { status: 403 });
  }

  const { error } = await service.from("sessions_log").delete().eq("id", parsed.data.id);
  if (error) return databaseError("删除交流记录", error.message);
  return new NextResponse(null, { status: 204 });
}
