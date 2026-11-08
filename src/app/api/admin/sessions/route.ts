import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
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
type SessionActor = { id: string; profile: Profile };

async function requireSessionActor(): Promise<SessionActor | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  if (
    !user.profile ||
    (!user.profile.is_admin &&
      !user.profile.is_volunteer &&
      user.profile.participant_role !== "mentor")
  ) {
    return NextResponse.json({ error: "没有权限执行此操作。" }, { status: 403 });
  }
  return { id: user.id, profile: user.profile };
}

async function authorizeCohort(
  actor: SessionActor,
  cohortId: string,
): Promise<NextResponse | null> {
  if (actor.profile.is_admin || !actor.profile.is_volunteer) return null;

  const client = await createClient();
  const { data, error } = await client.rpc("is_season_volunteer", {
    p_cohort_id: cohortId,
  });
  if (error) return databaseError("验证志愿者项目", error.message);
  if (!data) {
    return NextResponse.json({ error: "没有权限管理此项目的交流记录。" }, { status: 403 });
  }
  return null;
}

async function validateParticipants(
  service: ServiceClient,
  actor: SessionActor,
  session: Pick<
    SessionLog,
    "cohort_id" | "mentor_id" | "mentee_id" | "mentor_invite_id" | "mentee_invite_id"
  >,
) {
  const mentorSelectionId = session.mentor_id ?? session.mentor_invite_id;
  const menteeSelectionId = session.mentee_id ?? session.mentee_invite_id;
  const selectionIds = [mentorSelectionId, menteeSelectionId].filter(
    (id): id is string => Boolean(id),
  );
  const [{ data: cohort }, { data: profiles, error: profileError }, { data: invites, error: inviteError }] =
    await Promise.all([
      service.from("cohorts").select("id").eq("id", session.cohort_id).maybeSingle(),
      service
        .from("profiles")
        .select("id, participant_role, cohort_ids")
        .in("id", selectionIds),
      service
        .from("roster_invites")
        .select("id, cohort_id, participant_role, claimed_user_id, not_participating, email")
        .in("id", selectionIds),
    ]);
  if (!cohort) return "所选项目不存在。";
  if (profileError || inviteError) return "读取导师或学员失败。";

  const mentorProfile = profiles?.find((person) => person.id === mentorSelectionId);
  const menteeProfile = profiles?.find((person) => person.id === menteeSelectionId);
  const mentorInvite = invites?.find((invite) => invite.id === mentorSelectionId);
  const menteeInvite = invites?.find((invite) => invite.id === menteeSelectionId);
  const pendingInviteEmails = [mentorInvite, menteeInvite].flatMap((invite) =>
    invite && !invite.claimed_user_id ? [invite.email] : [],
  );
  const { data: accounts, error: accountError } = pendingInviteEmails.length
    ? await service
        .from("profiles")
        .select("id, email")
        .in("email", pendingInviteEmails)
    : { data: [], error: null };
  if (accountError) return "验证邀请状态失败。";

  if (
    (mentorProfile?.participant_role !== "mentor" &&
      mentorInvite?.participant_role !== "mentor") ||
    (menteeProfile?.participant_role !== "mentee" &&
      menteeInvite?.participant_role !== "mentee")
  ) {
    return "配对成员身份不正确。";
  }
  if (
    (mentorProfile && !mentorProfile.cohort_ids.includes(session.cohort_id)) ||
    (menteeProfile && !menteeProfile.cohort_ids.includes(session.cohort_id)) ||
    (mentorInvite &&
      (mentorInvite.cohort_id !== session.cohort_id ||
        mentorInvite.not_participating ||
        (!mentorInvite.claimed_user_id &&
          accounts?.some(
            (account) =>
              account.email?.trim().toLowerCase() ===
              mentorInvite.email.trim().toLowerCase(),
          )))) ||
    (menteeInvite &&
      (menteeInvite.cohort_id !== session.cohort_id ||
        menteeInvite.not_participating ||
        (!menteeInvite.claimed_user_id &&
          accounts?.some(
            (account) =>
              account.email?.trim().toLowerCase() ===
              menteeInvite.email.trim().toLowerCase(),
          ))))
  ) {
    return "导师和学员必须属于所选项目且邀请状态有效。";
  }

  if (mentorInvite || menteeInvite) {
    let matchQuery = service
      .from("matches")
      .select("id")
      .eq("cohort_id", session.cohort_id);
    matchQuery = mentorInvite
      ? matchQuery.eq("mentor_invite_id", mentorInvite.id)
      : matchQuery.eq("mentor_id", mentorProfile!.id);
    matchQuery = menteeInvite
      ? matchQuery.eq("mentee_invite_id", menteeInvite.id)
      : matchQuery.eq("mentee_id", menteeProfile!.id);
    const { data: match, error: matchError } = await matchQuery.maybeSingle();
    if (matchError) return "验证导师与学员配对失败。";
    if (!match) return "只能为已配对的学员记录交流。";
  }

  if (
    !actor.profile.is_admin &&
    !actor.profile.is_volunteer &&
    actor.profile.participant_role === "mentor"
  ) {
    if (mentorProfile?.id !== actor.id || mentorInvite) {
      return "导师只能管理自己的交流记录。";
    }
    let matchQuery = service
      .from("matches")
      .select("id")
      .eq("cohort_id", session.cohort_id)
      .eq("mentor_id", actor.id);
    matchQuery = menteeProfile
      ? matchQuery.eq("mentee_id", menteeProfile.id)
      : matchQuery.eq("mentee_invite_id", menteeInvite!.id);
    const { data: match } = await matchQuery.maybeSingle();
    if (!match) return "只能为已配对的学员记录交流。";
  }

  return {
    mentor_id: mentorProfile?.id ?? null,
    mentor_invite_id: mentorInvite?.id ?? null,
    mentee_id: menteeProfile?.id ?? null,
    mentee_invite_id: menteeInvite?.id ?? null,
  };
}

export async function POST(request: Request) {
  const actor = await requireSessionActor();
  if (actor instanceof NextResponse) return actor;

  const parsed = fieldsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请检查项目、成员、日期、类型和备注。");

  const authorizationError = await authorizeCohort(actor, parsed.data.cohort_id);
  if (authorizationError) return authorizationError;

  const service = createServiceRoleClient();
  const input = {
    ...parsed.data,
    mentor_id:
      !actor.profile.is_admin &&
      !actor.profile.is_volunteer &&
      actor.profile.participant_role === "mentor"
        ? actor.id
        : parsed.data.mentor_id,
    created_by: actor.id,
  };
  const participants = await validateParticipants(service, actor, {
    cohort_id: input.cohort_id,
    mentor_id: input.mentor_id,
    mentee_id: input.mentee_id,
    mentor_invite_id: null,
    mentee_invite_id: null,
  });
  if (typeof participants === "string") return invalidBody(participants);

  const { data, error } = await service
    .from("sessions_log")
    .insert({ ...input, ...participants })
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
    mentor_invite_id: parsed.data.patch.mentor_id
      ? null
      : current.mentor_invite_id,
    mentee_invite_id: parsed.data.patch.mentee_id
      ? null
      : current.mentee_invite_id,
  };
  const participants = await validateParticipants(service, actor, {
    cohort_id: current.cohort_id,
    mentor_id: next.mentor_id,
    mentee_id: next.mentee_id,
    mentor_invite_id: next.mentor_invite_id,
    mentee_invite_id: next.mentee_invite_id,
  });
  if (typeof participants === "string") return invalidBody(participants);

  const update =
    !actor.profile.is_admin && actor.profile.participant_role === "mentor"
      ? { ...parsed.data.patch, ...participants, mentor_id: actor.id }
      : { ...parsed.data.patch, ...participants };
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
    .select("cohort_id, mentor_id")
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
