import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const seasonSchema = z
  .object({
    cohort_id: z.uuid(),
    group_id: z.uuid().nullable(),
    is_lead: z.boolean().default(false),
  })
  // Leading no group is meaningless, and it would put someone in 战略组 with
  // nothing behind it. The import RPC rejects the same combination.
  .refine((season) => !season.is_lead || season.group_id !== null, {
    message: "负责人必须先选择所属组别。",
  });

const volunteerSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z
    .email()
    .max(320)
    .transform((value) => value.trim().toLowerCase())
    .nullable(),
  wechat_number: z.string().trim().max(200).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  is_public: z.boolean(),
  seasons: z.array(seasonSchema).max(50),
});

const createSchema = volunteerSchema;
const updateSchema = volunteerSchema.extend({ id: z.uuid() });
const deleteSchema = z.object({ id: z.uuid() });

/**
 * Writes go to `volunteers`, but the response comes back from
 * `volunteers_resolved` so the client immediately sees the same
 * profile-resolved shape `listVolunteers()` returns. Seasons are fetched
 * separately for the same reason as in the store: relationship inference
 * through a view is not worth depending on.
 */
async function readResolved(
  supabase: ReturnType<typeof createServiceRoleClient>,
  id: string,
) {
  const [volunteer, seasons] = await Promise.all([
    supabase.from("volunteers_resolved").select("*").eq("id", id).single(),
    supabase.from("volunteer_seasons").select("*").eq("volunteer_id", id),
  ]);
  if (volunteer.error) return { error: volunteer.error };
  if (seasons.error) return { error: seasons.error };
  return { data: { ...volunteer.data, seasons: seasons.data ?? [] } };
}

/**
 * `volunteers.email_key` and `name_key` carry unique indexes, so a clash comes
 * back as 23505 rather than as a silent second record. Which one it is tells
 * the admin what to change.
 */
function uniqueViolation(message: string): string | null {
  if (!message.includes("duplicate key")) return null;
  if (message.includes("idx_volunteers_email_key")) {
    return "该邮箱已属于另一位志愿者。请改用其他邮箱，或直接编辑那条已有记录。";
  }
  if (message.includes("idx_volunteers_name_key")) {
    return "该姓名已存在。请加上区分后缀（例如「小鱼 - 运营」），或直接编辑那条已有记录。";
  }
  return "该志愿者已存在。";
}

/**
 * Seasons are replaced wholesale rather than diffed: the dialog always submits
 * the complete list, so deleting the rows and reinserting them keeps the stored
 * set identical to what the admin sees on screen.
 */
async function replaceSeasons(
  supabase: ReturnType<typeof createServiceRoleClient>,
  volunteerId: string,
  seasons: z.infer<typeof seasonSchema>[],
) {
  const { error: deleteError } = await supabase
    .from("volunteer_seasons")
    .delete()
    .eq("volunteer_id", volunteerId);
  if (deleteError) return deleteError;

  if (seasons.length === 0) return null;

  const { error: insertError } = await supabase
    .from("volunteer_seasons")
    .insert(
      seasons.map((season) => ({
        volunteer_id: volunteerId,
        cohort_id: season.cohort_id,
        group_id: season.group_id,
        is_lead: season.is_lead,
      })),
    );
  return insertError;
}

export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidBody(
      `志愿者信息无效：${parsed.error.issues[0]?.message ?? "请检查必填项。"}`,
    );
  }

  const supabase = createServiceRoleClient();
  const { seasons, ...volunteer } = parsed.data;

  const { data, error } = await supabase
    .from("volunteers")
    .insert(volunteer)
    .select("id")
    .single();
  if (error) {
    const conflict = uniqueViolation(error.message);
    if (conflict) return invalidBody(conflict);
    return databaseError("创建志愿者", error.message);
  }

  const seasonError = await replaceSeasons(supabase, data.id, seasons);
  if (seasonError) return databaseError("保存志愿者季度", seasonError.message);

  const saved = await readResolved(supabase, data.id);
  if (saved.error) return databaseError("读取志愿者", saved.error.message);

  return NextResponse.json(saved.data);
}

export async function PATCH(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return invalidBody(
      `志愿者信息无效：${parsed.error.issues[0]?.message ?? "请检查必填项。"}`,
    );
  }

  const supabase = createServiceRoleClient();
  const { id, seasons, ...volunteer } = parsed.data;

  const { error } = await supabase
    .from("volunteers")
    .update(volunteer)
    .eq("id", id);
  if (error) {
    const conflict = uniqueViolation(error.message);
    if (conflict) return invalidBody(conflict);
    return databaseError("更新志愿者", error.message);
  }

  const seasonError = await replaceSeasons(supabase, id, seasons);
  if (seasonError) return databaseError("保存志愿者季度", seasonError.message);

  const saved = await readResolved(supabase, id);
  if (saved.error) return databaseError("读取志愿者", saved.error.message);

  return NextResponse.json(saved.data);
}

export async function DELETE(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的志愿者 ID。");

  // volunteer_seasons cascades from volunteers, so the season rows go with it.
  const { error } = await createServiceRoleClient()
    .from("volunteers")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return databaseError("删除志愿者", error.message);

  return NextResponse.json({ id: parsed.data.id });
}
