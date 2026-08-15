import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const schema = z.object({
  id: z.uuid(),
  hidden: z.boolean(),
});

export async function PATCH(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("留言 ID 或隐藏状态无效。");

  const { data, error } = await createServiceRoleClient()
    .from("bulletin_posts")
    .update({ hidden: parsed.data.hidden })
    .eq("id", parsed.data.id)
    .select("*")
    .maybeSingle();
  if (error) return databaseError("更新留言状态", error.message);
  if (!data) {
    return NextResponse.json({ error: "找不到该留言。" }, { status: 404 });
  }
  return NextResponse.json(data);
}
