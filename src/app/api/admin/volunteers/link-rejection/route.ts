import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../../_lib";

const schema = z.object({
  volunteer_id: z.uuid(),
  profile_id: z.uuid(),
});

/**
 * Records that a volunteer and a portal account are NOT the same person, so the
 * pair stops appearing in 待确认的账号关联.
 */
export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的志愿者与账号 ID。");

  const { error } = await createServiceRoleClient()
    .from("volunteer_link_rejections")
    .upsert(
      { ...parsed.data, rejected_by: actor.id },
      { onConflict: "volunteer_id,profile_id", ignoreDuplicates: true },
    );
  if (error) return databaseError("标记非同一人", error.message);

  return NextResponse.json({ ok: true });
}

/** Undoes a rejection, putting the pair back in the candidate list. */
export async function DELETE(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的志愿者与账号 ID。");

  const { error } = await createServiceRoleClient()
    .from("volunteer_link_rejections")
    .delete()
    .eq("volunteer_id", parsed.data.volunteer_id)
    .eq("profile_id", parsed.data.profile_id);
  if (error) return databaseError("撤销判定", error.message);

  return NextResponse.json({ ok: true });
}
