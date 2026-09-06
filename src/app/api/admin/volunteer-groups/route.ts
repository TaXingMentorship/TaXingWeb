import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const groupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).nullable(),
  sort_order: z.number().int().min(0).max(9999),
  /** Automatically contains every lead — how 战略组 works (migration 0013). */
  includes_leads: z.boolean().default(false),
});

const updateSchema = groupSchema.extend({ id: z.uuid() });
const deleteSchema = z.object({ id: z.uuid() });

function duplicateName(message: string): boolean {
  return message.includes("duplicate key") && message.includes("volunteer_groups");
}

export async function POST(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = groupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请填写组别名称，排序值需为 0–9999 的整数。");

  const { data, error } = await createServiceRoleClient()
    .from("volunteer_groups")
    .insert(parsed.data)
    .select("*")
    .single();
  if (error) {
    if (duplicateName(error.message)) {
      return invalidBody("已存在同名组别。请换一个名称，或直接编辑那个组别。");
    }
    return databaseError("创建组别", error.message);
  }

  return NextResponse.json(data);
}

export async function PATCH(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请填写组别名称，排序值需为 0–9999 的整数。");

  const { id, ...group } = parsed.data;
  const { data, error } = await createServiceRoleClient()
    .from("volunteer_groups")
    .update(group)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    if (duplicateName(error.message)) {
      return invalidBody("已存在同名组别。请换一个名称。");
    }
    return databaseError("更新组别", error.message);
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const actor = await requireApiRole("admin");
  if (actor instanceof NextResponse) return actor;

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("请提供有效的组别 ID。");

  // volunteer_seasons.group_id is ON DELETE SET NULL, so removing a group keeps
  // every volunteer and every season record — they just lose the group label.
  const { error } = await createServiceRoleClient()
    .from("volunteer_groups")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return databaseError("删除组别", error.message);

  return NextResponse.json({ id: parsed.data.id });
}
