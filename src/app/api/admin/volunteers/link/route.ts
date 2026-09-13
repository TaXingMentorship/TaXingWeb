import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../../_lib";

const schema = z.object({
  id: z.uuid(),
  /** null removes the link. */
  profile_id: z.uuid().nullable(),
});

/**
 * Confirms — or removes — the link between a volunteer and a portal account.
 *
 * Email matches are made automatically by the triggers in migration 0012. This
 * endpoint exists for the case they deliberately do not cover: a volunteer and
 * a profile that share a name but not an email. Only a person can say whether
 * those are the same human, so only a person may make that link.
 */
export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的志愿者与账号 ID。");

  const supabase = createServiceRoleClient();
  const { id, profile_id } = parsed.data;

  if (profile_id) {
    // One account, one volunteer record — otherwise "my group" and the
    // resolved name would both become ambiguous.
    const { data: taken, error: takenError } = await supabase
      .from("volunteers")
      .select("id, full_name")
      .eq("profile_id", profile_id)
      .neq("id", id)
      .maybeSingle();
    if (takenError) return databaseError("检查账号关联", takenError.message);
    if (taken) {
      return invalidBody(
        `该门户账号已关联到志愿者「${taken.full_name}」。请先解除那条关联。`,
      );
    }
  }

  const { error } = await supabase
    .from("volunteers")
    .update({ profile_id })
    .eq("id", id);
  if (error) return databaseError(profile_id ? "关联账号" : "解除关联", error.message);

  const { data, error: readError } = await supabase
    .from("volunteers_resolved")
    .select("*")
    .eq("id", id)
    .single();
  if (readError) return databaseError("读取志愿者", readError.message);

  return NextResponse.json(data);
}
