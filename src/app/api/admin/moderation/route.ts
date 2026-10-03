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

const BULLETIN_CATEGORIES = [
  "wish",
  "thanks",
  "growth",
  "question",
  "feedback",
  "expectation",
  "reflection",
  "other",
] as const;
const BULLETIN_COLORS = [
  "default",
  "yellow",
  "pink",
  "blue",
  "green",
  "purple",
  "orange",
] as const;

// Same limits as PostComposer / PostComments.
const editPostSchema = z.object({
  action: z.literal("edit"),
  target: z.literal("post"),
  id: z.uuid(),
  title: z.string().trim().max(60).nullable(),
  body: z.string().trim().min(1).max(2000),
  category: z.enum(BULLETIN_CATEGORIES),
  color: z.enum(BULLETIN_COLORS),
});

const editCommentSchema = z.object({
  action: z.literal("edit"),
  target: z.literal("comment"),
  id: z.uuid(),
  body: z.string().trim().min(1).max(2000),
});

const editSchema = z.discriminatedUnion("target", [
  editPostSchema,
  editCommentSchema,
]);

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
 * Author-only edit (migration 0023). Unlike every other change in this route
 * there is no admin override: moderators can hide or delete, never reword.
 * The archive rule and season membership are enforced here because the
 * service-role client skips RLS and 0015 / 0020 only guard inserts — a closed
 * board or season is read-only, and so is a season you have left.
 */
async function editContent(
  edit: z.infer<typeof editSchema>,
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录。" }, { status: 401 });
  }
  const supabase = createServiceRoleClient();

  let boardId: string;
  let cohortId: string;
  let authorId: string | null;
  let before: Record<string, unknown>;

  if (edit.target === "post") {
    const { data: row } = await supabase
      .from("bulletin_posts")
      .select(
        "author_id, cohort_id, board_id, hidden, title, body, category, color",
      )
      .eq("id", edit.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "找不到该留言。" }, { status: 404 });
    ({ author_id: authorId, cohort_id: cohortId, board_id: boardId } = row);
    before = row;
  } else {
    const { data: row } = await supabase
      .from("bulletin_comments")
      .select("author_id, cohort_id, post_id, hidden, body")
      .eq("id", edit.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "找不到该评论。" }, { status: 404 });
    const { data: post } = await supabase
      .from("bulletin_posts")
      .select("board_id")
      .eq("id", row.post_id)
      .maybeSingle();
    if (!post) return NextResponse.json({ error: "找不到该留言。" }, { status: 404 });
    ({ author_id: authorId, cohort_id: cohortId } = row);
    boardId = post.board_id;
    before = row;
  }

  if (authorId !== user.id) {
    return NextResponse.json(
      { error: "只能修改自己发布的内容。" },
      { status: 403 },
    );
  }

  // The author still sees their hidden content, but must not be able to
  // reword what a moderator pulled — an admin could unhide it later without
  // noticing the change.
  if (before.hidden) {
    return NextResponse.json(
      { error: "该内容已被管理员隐藏，不能修改。" },
      { status: 403 },
    );
  }

  // Same gate as the insert policies (0015 / 0020): a current member of the
  // season, in a writing role. Someone who has since left the season can no
  // longer reword what they posted there.
  const profile = user.profile;
  const canWrite =
    profile?.is_admin ||
    profile?.participant_role != null ||
    profile?.is_volunteer;
  if (!canWrite || !profile?.cohort_ids.includes(cohortId)) {
    return NextResponse.json(
      { error: "你已不在该季度，内容不能再修改。" },
      { status: 403 },
    );
  }

  const [{ data: board }, { data: cohort }] = await Promise.all([
    supabase
      .from("bulletin_boards")
      .select("is_open, allowed_categories")
      .eq("id", boardId)
      .maybeSingle(),
    supabase
      .from("cohorts")
      .select("bulletin_open")
      .eq("id", cohortId)
      .maybeSingle(),
  ]);
  if (!board?.is_open || !cohort?.bulletin_open) {
    return NextResponse.json(
      { error: "该留言板已关闭，内容不能再修改。" },
      { status: 403 },
    );
  }

  let patch: Record<string, unknown>;
  if (edit.target === "post") {
    const allowed = board.allowed_categories as string[] | null;
    // Only when the category is being changed: an admin may have narrowed the
    // board's categories since this post was written, and that must not block
    // fixing a typo in it.
    if (
      edit.category !== before.category &&
      allowed?.length &&
      !allowed.includes(edit.category)
    ) {
      return invalidBody("该留言板不支持这个分类。");
    }
    patch = {
      title: edit.title || null,
      body: edit.body,
      category: edit.category,
      color: edit.color,
    };
  } else {
    patch = { body: edit.body };
  }

  // Saving without a real change must not stamp 「已编辑」.
  const changed = Object.entries(patch).some(([key, value]) => before[key] !== value);
  if (!changed) return NextResponse.json({ edited_at: null });

  const editedAt = new Date().toISOString();
  const { error } = await supabase
    .from(TABLES[edit.target])
    .update({ ...patch, edited_at: editedAt })
    .eq("id", edit.id);
  if (error) {
    return databaseError(edit.target === "post" ? "修改留言" : "修改评论", error.message);
  }
  return NextResponse.json({ edited_at: editedAt });
}

/**
 * Marking a question 答疑完毕 is the author's call as much as a moderator's,
 * so `resolved` on its own is allowed for the author too. Everything else —
 * pinning, hiding, any comment change — stays admin-only.
 */
export async function PATCH(request: Request) {
  const json: unknown = await request.json().catch(() => null);

  if (json && typeof json === "object" && "action" in json && json.action === "edit") {
    const edit = editSchema.safeParse(json);
    if (!edit.success) return invalidBody("修改的内容无效：正文不能为空，且不能过长。");
    return editContent(edit.data);
  }

  const parsed = schema.safeParse(json);
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
      "只有发布者本人或负责人可以标记已解答。",
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
    "只有发布者本人或负责人可以删除。",
  );
  if (denied) return denied;

  const supabase = createServiceRoleClient();

  // A post's images live in Storage, not in the row — deleting the row alone
  // would leave them behind with nothing pointing at them.
  if (target === "post") {
    const { data: post } = await supabase
      .from("bulletin_posts")
      .select("image_paths")
      .eq("id", id)
      .maybeSingle();
    if (post?.image_paths?.length) {
      await supabase.storage.from("bulletin").remove(post.image_paths);
    }
  }

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) {
    return databaseError(target === "post" ? "删除留言" : "删除评论", error.message);
  }
  return NextResponse.json({ ok: true });
}
