import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { databaseError, invalidBody, requireApiRole } from "../_lib";

const postSchema = z.object({
  target: z.literal("post"),
  id: z.uuid(),
  hidden: z.boolean().optional(),
  pinned: z.boolean().optional(),
  resolved: z.boolean().optional(),
});

const commentSchema = z.object({
  target: z.literal("comment"),
  id: z.uuid(),
  hidden: z.boolean(),
});

const schema = z.discriminatedUnion("target", [postSchema, commentSchema]);

const deleteSchema = z.object({
  target: z.enum(["post", "comment"]),
  id: z.uuid(),
});

const TABLES = {
  post: "bulletin_posts",
  comment: "bulletin_comments",
} as const;

/** Admins pass unconditionally; otherwise the caller must own the row. */
async function authorizeAuthorOrAdmin(
  table: (typeof TABLES)[keyof typeof TABLES],
  id: string,
  denialMessage: string,
): Promise<NextResponse | null> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  if (user.profile?.is_admin) return null;

  const { data: row } = await createServiceRoleClient()
    .from(table)
    .select("author_id")
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "找不到该内容。" }, { status: 404 });
  }
  if (row.author_id !== user.id) {
    return NextResponse.json({ error: denialMessage }, { status: 403 });
  }
  return null;
}

/**
 * Marking a question 答疑完毕 is the author's call as much as a moderator's,
 * so `resolved` on its own is allowed for the author too. Everything else —
 * pinning, hiding, any comment change — stays admin-only.
 */
export async function PATCH(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("留言 ID 或操作参数无效。");

  const { target, id, ...rest } = parsed.data;
  const patch = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(patch).length === 0) {
    return invalidBody("没有需要更新的字段。");
  }

  const isResolveOnly =
    target === "post" &&
    Object.keys(patch).length === 1 &&
    "resolved" in patch;

  if (isResolveOnly) {
    const denied = await authorizeAuthorOrAdmin(
      TABLES.post,
      id,
      "只有发布者本人或管理员可以标记已解答。",
    );
    if (denied) return denied;
  } else {
    const actor = await requireApiRole("admin");
    if (actor instanceof NextResponse) return actor;
  }

  const table = target === "post" ? "bulletin_posts" : "bulletin_comments";
  const operation = target === "post" ? "更新留言状态" : "更新评论状态";

  const { data, error } = await createServiceRoleClient()
    .from(table)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return databaseError(operation, error.message);
  if (!data) {
    return NextResponse.json(
      { error: target === "post" ? "找不到该留言。" : "找不到该评论。" },
      { status: 404 },
    );
  }
  return NextResponse.json(data);
}

/**
 * Deletion moved server-side with migration 0009: clients no longer hold
 * SELECT on the bulletin tables, so a filtered client-side DELETE is not
 * possible. Authorization matches the policy it replaces — author or admin.
 */
export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalidBody("删除参数无效。");

  const { target, id } = parsed.data;
  const table = TABLES[target];

  const denied = await authorizeAuthorOrAdmin(
    table,
    id,
    "只有发布者本人或管理员可以删除。",
  );
  if (denied) return denied;

  const { error } = await createServiceRoleClient()
    .from(table)
    .delete()
    .eq("id", id);
  if (error) {
    return databaseError(target === "post" ? "删除留言" : "删除评论", error.message);
  }
  return NextResponse.json({ ok: true });
}
