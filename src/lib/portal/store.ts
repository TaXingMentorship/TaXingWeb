"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  BulletinBoard,
  BulletinCategory,
  BulletinColor,
  BulletinComment,
  BulletinPost,
  BulletinReaction,
  Cohort,
  BoardNotice,
  BoardNoticeKind,
  Match,
  MentorGroup,
  MentorGroupMember,
  ParticipationRecord,
  ParticipantRole,
  Profile,
  RosterInvite,
  SessionLog,
  SessionType,
  ResolvedVolunteer,
  ResolvedVolunteerWithSeasons,
  VolunteerGroup,
  VolunteerSeason,
  VolunteerSeasonChange,
  VolunteerWithSeasons,
  MyTask,
  NameChangeRequest,
  Task,
  TaskWithAssignments,
  UnreadPostSummary,
} from "@/types/portal";

type SupabaseError = {
  message: string;
};

function throwQueryError(operation: string, error: SupabaseError | null): void {
  if (error) throw new Error(`${operation}失败：${error.message}`);
}

async function adminJson<T>(
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
  operation: string,
): Promise<T> {
  const response = await fetch(endpoint, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `${response.status} ${response.statusText}`;
    throw new Error(`${operation}失败：${message}`);
  }

  if (payload === null) {
    throw new Error(`${operation}失败：管理接口返回了空响应`);
  }
  return payload as T;
}

function postAdminJson<T>(
  endpoint: string,
  body: unknown,
  operation: string,
): Promise<T> {
  return adminJson(endpoint, "POST", body, operation);
}

// --- Cohorts ---------------------------------------------------------------

/**
 * Newest season first, so every cohort picker defaults to the current one.
 * `starts_at` is nullable — those sink to the bottom and fall back to
 * `created_at`. RLS (`cohorts_select_member`) already scopes the result:
 * members get their own cohorts, admins get all of them.
 */
export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await createClient()
    .from("cohorts")
    .select("*")
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  throwQueryError("读取项目", error);
  return (data ?? []) as Cohort[];
}

export async function createCohort(input: {
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  bulletin_open: boolean;
}): Promise<Cohort> {
  const { data, error } = await createClient()
    .from("cohorts")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("创建季度", error);
  return data as Cohort;
}

export async function updateCohort(
  id: string,
  patch: Partial<
    Pick<Cohort, "name" | "starts_at" | "ends_at" | "bulletin_open">
  >,
): Promise<Cohort> {
  const { data, error } = await createClient()
    .from("cohorts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwQueryError("更新季度", error);
  return data as Cohort;
}

/** Season-wide switch: closing it makes every board in the cohort read-only. */
export function setCohortBulletinOpen(
  id: string,
  open: boolean,
): Promise<Cohort> {
  return updateCohort(id, { bulletin_open: open });
}

export async function getCohort(id: string): Promise<Cohort | null> {
  const { data, error } = await createClient()
    .from("cohorts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwQueryError("读取项目", error);
  return data as Cohort | null;
}

// --- Profiles --------------------------------------------------------------

export async function listProfiles(filter?: {
  participantRole?: ParticipantRole;
  cohortId?: string;
}): Promise<Profile[]> {
  let query = createClient().from("profiles").select("*");
  if (filter?.participantRole) {
    query = query.eq("participant_role", filter.participantRole);
  }
  if (filter?.cohortId) {
    query = query.contains("cohort_ids", [filter.cohortId]);
  }

  const { data, error } = await query.order("created_at", { ascending: true });
  throwQueryError("读取用户资料", error);
  return (data ?? []) as Profile[];
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwQueryError("读取用户资料", error);
  return data as Profile | null;
}

export async function updateProfile(
  id: string,
  patch: Partial<
    Omit<
      Profile,
      | "id"
      | "participant_role"
      | "is_admin"
      | "is_volunteer"
      | "cohort_ids"
      | "email"
      | "created_at"
    >
  >,
): Promise<Profile> {
  const { data, error } = await createClient()
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwQueryError("更新用户资料", error);
  return data as Profile;
}

// --- Bulletin boards -------------------------------------------------------

export async function listBoards(filter?: {
  cohortIds?: string[];
}): Promise<BulletinBoard[]> {
  if (filter?.cohortIds?.length === 0) return [];

  let query = createClient().from("bulletin_boards").select("*");
  if (filter?.cohortIds) {
    query = query.in("cohort_id", filter.cohortIds);
  }

  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  throwQueryError("读取留言板", error);
  return (data ?? []) as BulletinBoard[];
}

export async function getBoard(id: string): Promise<BulletinBoard | null> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwQueryError("读取留言板", error);
  return data as BulletinBoard | null;
}

export async function createBoard(input: {
  cohort_id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  allowed_categories: BulletinCategory[] | null;
  allow_anonymous: boolean;
  allow_comments: boolean;
  prompt: string | null;
  sort_order: number;
  use_groups?: boolean;
}): Promise<BulletinBoard> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("创建留言板", error);
  return data as BulletinBoard;
}

/**
 * Admin edit of a board's settings. `cohort_id` is deliberately not
 * editable: posts carry their own `cohort_id`, so moving a board between
 * seasons would leave its posts pointing at the old one.
 */
export async function updateBoard(
  id: string,
  patch: Partial<
    Pick<
      BulletinBoard,
      | "name"
      | "description"
      | "prompt"
      | "is_open"
      | "allowed_categories"
      | "allow_anonymous"
      | "allow_comments"
      | "sort_order"
      | "use_groups"
    >
  >,
): Promise<BulletinBoard> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwQueryError("更新留言板", error);
  return data as BulletinBoard;
}

/** Individual board switch; the cohort switch remains the global override. */
export function setBoardOpen(
  id: string,
  open: boolean,
): Promise<BulletinBoard> {
  return updateBoard(id, { is_open: open });
}

/** Uses the existing sort order as the pin state: -1 is pinned, 0 is normal. */
export async function setBoardPinned(
  id: string,
  pinned: boolean,
): Promise<BulletinBoard> {
  return updateBoard(id, { sort_order: pinned ? -1 : 0 });
}

/**
 * Removes the board and, through `on delete cascade` on `bulletin_posts`,
 * every post, comment and reaction on it. Admin-only via RLS
 * (`boards_admin_all`).
 */
export async function deleteBoard(id: string): Promise<void> {
  const { error } = await createClient()
    .from("bulletin_boards")
    .delete()
    .eq("id", id);
  throwQueryError("删除留言板", error);
}

/** Number of RLS-visible posts per board, keyed by board id. */
export async function countPostsByBoard(
  includeHidden = false,
): Promise<Record<string, number>> {
  let query = createClient()
    .from("bulletin_posts_readable")
    .select("board_id");
  if (!includeHidden) query = query.eq("hidden", false);

  const { data, error } = await query;
  throwQueryError("统计留言", error);

  const counts: Record<string, number> = {};
  for (const post of data ?? []) {
    counts[post.board_id] = (counts[post.board_id] ?? 0) + 1;
  }
  return counts;
}

// --- Bulletin posts --------------------------------------------------------

export async function listPosts(filter?: {
  boardId?: string;
  cohortId?: string;
  includeHidden?: boolean;
}): Promise<BulletinPost[]> {
  let query = createClient().from("bulletin_posts_readable").select("*");
  if (filter?.boardId) query = query.eq("board_id", filter.boardId);
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  if (!filter?.includeHidden) query = query.eq("hidden", false);

  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  throwQueryError("读取留言", error);
  return (data ?? []) as BulletinPost[];
}

export async function createPost(input: {
  cohort_id: string;
  board_id: string;
  author_id: string;
  category: BulletinCategory;
  title: string | null;
  body: string;
  is_anonymous: boolean;
  color: BulletinColor;
  image_paths: string[];
  /** Required on boards with use_groups; null elsewhere. */
  group_id?: string | null;
}): Promise<void> {
  // No .select() — 0009 revoked SELECT on the base table, so reading the row
  // back would fail. Callers refetch through the view instead.
  const { error } = await createClient().from("bulletin_posts").insert(input);
  throwQueryError("发布留言", error);
}

export async function setPostHidden(
  id: string,
  hidden: boolean,
): Promise<BulletinPost> {
  return adminJson<BulletinPost>(
    "/api/admin/moderation",
    "PATCH",
    { target: "post", id, hidden },
    "更新留言状态",
  );
}

export async function setPostPinned(
  id: string,
  pinned: boolean,
): Promise<BulletinPost> {
  return adminJson<BulletinPost>(
    "/api/admin/moderation",
    "PATCH",
    { target: "post", id, pinned },
    "更新置顶状态",
  );
}

export async function setPostResolved(
  id: string,
  resolved: boolean,
): Promise<BulletinPost> {
  return adminJson<BulletinPost>(
    "/api/admin/moderation",
    "PATCH",
    { target: "post", id, resolved },
    "更新解答状态",
  );
}

export async function setCommentHidden(
  id: string,
  hidden: boolean,
): Promise<BulletinComment> {
  return adminJson<BulletinComment>(
    "/api/admin/moderation",
    "PATCH",
    { target: "comment", id, hidden },
    "更新评论状态",
  );
}

/**
 * Author-only edit of a post's text, category and colour. Anonymity and
 * images are fixed once posted. Resolves to the stored `edited_at`, or null
 * when nothing actually changed.
 */
export async function editPost(
  id: string,
  input: {
    title: string | null;
    body: string;
    category: BulletinCategory;
    color: BulletinColor;
  },
): Promise<string | null> {
  const result = await adminJson<{ edited_at: string | null }>(
    "/api/admin/moderation",
    "PATCH",
    { action: "edit", target: "post", id, ...input },
    "修改留言",
  );
  return result.edited_at;
}

export async function editComment(
  id: string,
  body: string,
): Promise<string | null> {
  const result = await adminJson<{ edited_at: string | null }>(
    "/api/admin/moderation",
    "PATCH",
    { action: "edit", target: "comment", id, body },
    "修改评论",
  );
  return result.edited_at;
}

export async function deletePost(id: string): Promise<void> {
  await adminJson("/api/admin/moderation", "DELETE", { target: "post", id }, "删除留言");
}

// --- Bulletin comments -----------------------------------------------------

/**
 * Comments for a whole board in one round trip; callers group them by
 * `post_id`. Mirrors countPostsByBoard's client-side aggregation — fine at
 * this scale, and it keeps the wall to a fixed number of queries.
 */
export async function listComments(filter: {
  postIds: string[];
  includeHidden?: boolean;
}): Promise<BulletinComment[]> {
  if (filter.postIds.length === 0) return [];

  let query = createClient()
    .from("bulletin_comments_readable")
    .select("*")
    .in("post_id", filter.postIds);
  if (!filter.includeHidden) query = query.eq("hidden", false);

  const { data, error } = await query.order("created_at", { ascending: true });
  throwQueryError("读取评论", error);
  return (data ?? []) as BulletinComment[];
}

export async function createComment(input: {
  post_id: string;
  cohort_id: string;
  author_id: string;
  body: string;
  is_anonymous: boolean;
}): Promise<void> {
  const { error } = await createClient().from("bulletin_comments").insert(input);
  throwQueryError("发表评论", error);
}

export async function deleteComment(id: string): Promise<void> {
  await adminJson(
    "/api/admin/moderation",
    "DELETE",
    { target: "comment", id },
    "删除评论",
  );
}

// --- Bulletin reactions ----------------------------------------------------

export async function listReactions(filter: {
  postIds: string[];
}): Promise<BulletinReaction[]> {
  if (filter.postIds.length === 0) return [];

  const { data, error } = await createClient()
    .from("bulletin_reactions")
    .select("*")
    .in("post_id", filter.postIds);
  throwQueryError("读取表情反应", error);
  return (data ?? []) as BulletinReaction[];
}

/** Adds the reaction, or removes it when the user already left that emoji. */
export async function toggleReaction(input: {
  post_id: string;
  cohort_id: string;
  user_id: string;
  emoji: string;
  active: boolean;
}): Promise<void> {
  const supabase = createClient();

  if (input.active) {
    const { error } = await supabase
      .from("bulletin_reactions")
      .delete()
      .eq("post_id", input.post_id)
      .eq("user_id", input.user_id)
      .eq("emoji", input.emoji);
    throwQueryError("取消表情反应", error);
    return;
  }

  const { error } = await supabase.from("bulletin_reactions").insert({
    post_id: input.post_id,
    cohort_id: input.cohort_id,
    user_id: input.user_id,
    emoji: input.emoji,
  });
  throwQueryError("添加表情反应", error);
}

// --- Sessions log ----------------------------------------------------------

export async function listSessions(filter?: {
  cohortId?: string;
  mentorId?: string;
  menteeId?: string;
}): Promise<SessionLog[]> {
  let query = createClient().from("sessions_log").select("*");
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  if (filter?.mentorId) query = query.eq("mentor_id", filter.mentorId);
  if (filter?.menteeId) query = query.eq("mentee_id", filter.menteeId);

  const { data, error } = await query.order("session_date", {
    ascending: false,
  });
  throwQueryError("读取活动记录", error);
  return (data ?? []) as SessionLog[];
}

export async function logSession(input: {
  cohort_id: string;
  mentor_id: string;
  mentee_id: string;
  session_type: SessionType;
  session_date: string;
  notes: string | null;
  created_by: string | null;
}): Promise<SessionLog> {
  return postAdminJson<SessionLog>(
    "/api/admin/sessions",
    input,
    "新增活动记录",
  );
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<SessionLog, "id" | "created_at">>,
): Promise<SessionLog> {
  return adminJson<SessionLog>(
    "/api/admin/sessions",
    "PATCH",
    { id, patch },
    "更新活动记录",
  );
}

export async function deleteSession(id: string): Promise<void> {
  const response = await fetch("/api/admin/sessions", {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `${response.status} ${response.statusText}`;
    throw new Error(`删除活动记录失败：${message}`);
  }
}

// --- Participation records (mentee) ----------------------------------------

export async function listParticipation(filter?: {
  cohortId?: string;
  menteeId?: string;
}): Promise<ParticipationRecord[]> {
  let query = createClient().from("participation_records").select("*");
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  if (filter?.menteeId) query = query.eq("mentee_id", filter.menteeId);

  const { data, error } = await query.order("created_at", { ascending: false });
  throwQueryError("读取参与记录", error);
  return (data ?? []) as ParticipationRecord[];
}

export async function createParticipation(input: {
  cohort_id: string;
  mentee_id: string;
  event_name: string;
  screenshot_name: string | null;
  screenshot_path: string | null;
}): Promise<ParticipationRecord> {
  const { data, error } = await createClient()
    .from("participation_records")
    .insert({ ...input, screenshot_url: null })
    .select("*")
    .single();
  throwQueryError("新增参与记录", error);
  return data as ParticipationRecord;
}

export async function deleteParticipation(id: string): Promise<void> {
  const supabase = createClient();
  const { data: record, error: readError } = await supabase
    .from("participation_records")
    .select("screenshot_path")
    .eq("id", id)
    .maybeSingle();
  throwQueryError("读取参与记录", readError);

  if (record?.screenshot_path) {
    const { error: storageError } = await supabase.storage
      .from("participation")
      .remove([record.screenshot_path]);
    throwQueryError("删除参与截图", storageError);
  }

  const { error } = await supabase
    .from("participation_records")
    .delete()
    .eq("id", id);
  throwQueryError("删除参与记录", error);
}

// --- Roster import ---------------------------------------------------------

export type RosterRowInput = {
  email: string;
  full_name: string;
  participant_role: ParticipantRole | null;
  is_admin: boolean;
  is_volunteer: boolean;
};

export type ImportResult = {
  added: RosterInvite[];
  skipped: { row: RosterRowInput; reason: string }[];
  errors: { row: RosterRowInput; reason: string }[];
};

export async function importRoster(
  cohortId: string,
  rows: RosterRowInput[],
): Promise<ImportResult> {
  return postAdminJson<ImportResult>(
    "/api/admin/import",
    { cohortId, rows },
    "导入名单",
  );
}

export async function listRosterInvites(
  cohortId?: string,
): Promise<RosterInvite[]> {
  let query = createClient().from("roster_invites").select("*");
  if (cohortId) query = query.eq("cohort_id", cohortId);

  const { data, error } = await query.order("invited_at", { ascending: false });
  throwQueryError("读取邀请名单", error);
  return (data ?? []) as RosterInvite[];
}

// --- Matching --------------------------------------------------------------

export async function listMatches(filter?: {
  cohortId?: string;
  mentorId?: string;
  menteeId?: string;
}): Promise<Match[]> {
  let query = createClient().from("matches").select("*");
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  if (filter?.mentorId) query = query.eq("mentor_id", filter.mentorId);
  if (filter?.menteeId) query = query.eq("mentee_id", filter.menteeId);

  const { data, error } = await query.order("created_at", { ascending: true });
  throwQueryError("读取配对", error);
  return (data ?? []) as Match[];
}

export type MatchRowInput = {
  mentor_id: string;
  mentee_id: string;
};

export type MatchImportResult = {
  added: Match[];
  skipped: { row: MatchRowInput; reason: string }[];
  errors: { row: MatchRowInput; reason: string }[];
};

export async function importMatches(
  cohortId: string,
  rows: MatchRowInput[],
): Promise<MatchImportResult> {
  return postAdminJson<MatchImportResult>(
    "/api/admin/matches",
    { cohortId, rows },
    "导入配对",
  );
}

/**
 * Changes who someone is: mentor/mentee, admin, volunteer.
 *
 * Not a `updateProfile` patch — that function deliberately omits these fields.
 * Granting admin is the most privileged write in the app, so it goes through a
 * route handler like every other one (`protect_profile_privileges` in migration
 * 0004 is the database's own backstop).
 */
export function updateProfileIdentity(
  id: string,
  identity: {
    participant_role: ParticipantRole | null;
    is_admin: boolean;
    is_volunteer: boolean;
  },
): Promise<Profile> {
  return adminJson<Profile>(
    "/api/admin/profiles",
    "PATCH",
    { id, ...identity },
    "更新成员身份",
  );
}

// --- Unread comments on my posts -------------------------------------------

export async function listMyUnreadComments(): Promise<UnreadPostSummary[]> {
  const { data, error } = await createClient().rpc("my_unread_comment_summary");
  throwQueryError("读取新评论提醒", error);
  return (data ?? []) as UnreadPostSummary[];
}

/**
 * Records that the viewer has seen a followed post's comments up to `seenAt` —
 * the `created_at` of the newest comment they actually loaded, a server
 * timestamp, so the device clock never matters. null means "now". 0031 clamps
 * it to the server clock and never moves it backwards.
 */
export async function markPostSeen(
  userId: string,
  postId: string,
  seenAt: string | null,
): Promise<void> {
  const { error } = await createClient()
    .from("bulletin_post_reads")
    .upsert(
      { user_id: userId, post_id: postId, seen_at: seenAt },
      { onConflict: "user_id,post_id" },
    );
  throwQueryError("标记评论已读", error);
}

// --- Mentor Q&A groups -----------------------------------------------------

/**
 * Groups are readable by every signed-in member and written by admins through
 * the browser client (`mentor_groups_admin_all`, migration 0028) — the same
 * shape as bulletin boards, so no API route is involved.
 */
export async function listMentorGroups(filter?: {
  cohortId?: string;
}): Promise<MentorGroup[]> {
  let query = createClient().from("mentor_groups").select("*");
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  const { data, error } = await query
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  throwQueryError("读取答疑组", error);
  return (data ?? []) as MentorGroup[];
}

export type MentorGroupInput = {
  cohort_id: string;
  direction: string | null;
  name: string;
  sort_order: number;
};

export async function createMentorGroup(
  input: MentorGroupInput,
): Promise<MentorGroup> {
  const { data, error } = await createClient()
    .from("mentor_groups")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("创建答疑组", error);
  return data as MentorGroup;
}

export async function updateMentorGroup(
  id: string,
  patch: Partial<Pick<MentorGroup, "direction" | "name" | "sort_order">>,
): Promise<MentorGroup> {
  const { data, error } = await createClient()
    .from("mentor_groups")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  throwQueryError("更新答疑组", error);
  return data as MentorGroup;
}

/** Members leave with the group (cascade); posts stay, ungrouped. */
export async function deleteMentorGroup(id: string): Promise<void> {
  const { error } = await createClient().from("mentor_groups").delete().eq("id", id);
  throwQueryError("删除答疑组", error);
}

export async function listMentorGroupMembers(filter?: {
  cohortId?: string;
}): Promise<MentorGroupMember[]> {
  let query = createClient().from("mentor_group_members").select("*");
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  const { data, error } = await query;
  throwQueryError("读取答疑组成员", error);
  return (data ?? []) as MentorGroupMember[];
}

/**
 * Seats mentors in a group for one season, or unseats them when `groupId` is
 * null. `unique (cohort_id, profile_id)` makes this a move, not an addition.
 */
export async function setMentorGroup(input: {
  cohortId: string;
  profileIds: string[];
  groupId: string | null;
}): Promise<void> {
  if (input.profileIds.length === 0) return;
  const supabase = createClient();
  if (input.groupId === null) {
    const { error } = await supabase
      .from("mentor_group_members")
      .delete()
      .eq("cohort_id", input.cohortId)
      .in("profile_id", input.profileIds);
    throwQueryError("移出答疑组", error);
    return;
  }
  const { error } = await supabase.from("mentor_group_members").upsert(
    input.profileIds.map((profile_id) => ({
      cohort_id: input.cohortId,
      group_id: input.groupId,
      profile_id,
    })),
    { onConflict: "cohort_id,profile_id" },
  );
  throwQueryError("分配答疑组", error);
}

// --- Board notices ---------------------------------------------------------

/**
 * Whether the signed-in user is on the volunteer roster for one season — the
 * rule board_notices_staff_all applies (0032). `profiles.is_volunteer` has no
 * season and does not decide this.
 */
export async function isSeasonVolunteer(cohortId: string): Promise<boolean> {
  const { data, error } = await createClient().rpc("is_season_volunteer", {
    p_cohort_id: cohortId,
  });
  throwQueryError("读取志愿者季度", error);
  return Boolean(data);
}

export async function listBoardNotices(boardId: string): Promise<BoardNotice[]> {
  const { data, error } = await createClient()
    .from("board_notices")
    .select("*")
    .eq("board_id", boardId)
    .order("created_at", { ascending: false });
  throwQueryError("读取须知与提醒", error);
  return (data ?? []) as BoardNotice[];
}

export async function createBoardNotice(input: {
  board_id: string;
  group_id: string | null;
  kind: BoardNoticeKind;
  body: string;
  created_by: string;
  expires_at?: string | null;
}): Promise<void> {
  const { error } = await createClient().from("board_notices").insert(input);
  throwQueryError("发布须知或提醒", error);
}

export async function updateBoardNotice(id: string, body: string): Promise<void> {
  const { error } = await createClient()
    .from("board_notices")
    .update({ body })
    .eq("id", id);
  throwQueryError("更新须知", error);
}

export async function deleteBoardNotice(id: string): Promise<void> {
  const { error } = await createClient().from("board_notices").delete().eq("id", id);
  throwQueryError("删除须知或提醒", error);
}

// --- Volunteers ------------------------------------------------------------

export async function listVolunteerGroups(): Promise<VolunteerGroup[]> {
  const { data, error } = await createClient()
    .from("volunteer_groups")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  throwQueryError("读取志愿者组别", error);
  return (data ?? []) as VolunteerGroup[];
}

/**
 * The whole roster, read through `volunteers_resolved` so a volunteer linked to
 * a portal account shows that account's name, contact details and avatar
 * (migration 0012). Every signed-in member sees every volunteer; the group tabs
 * on /portal/volunteers are views over this list, not access boundaries.
 *
 * Seasons are fetched alongside and joined here rather than embedded in the
 * query: PostgREST's relationship inference through a view is not something to
 * depend on, and two parallel requests over a few hundred rows cost nothing.
 */
export async function listVolunteers(): Promise<ResolvedVolunteerWithSeasons[]> {
  const supabase = createClient();
  const [volunteers, seasons] = await Promise.all([
    supabase
      .from("volunteers_resolved")
      .select("*")
      .order("full_name", { ascending: true }),
    supabase
      .from("volunteer_seasons")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  throwQueryError("读取志愿者", volunteers.error);
  throwQueryError("读取志愿者季度", seasons.error);

  const byVolunteer = new Map<string, VolunteerSeason[]>();
  for (const season of (seasons.data ?? []) as VolunteerSeason[]) {
    const bucket = byVolunteer.get(season.volunteer_id);
    if (bucket) bucket.push(season);
    else byVolunteer.set(season.volunteer_id, [season]);
  }

  return ((volunteers.data ?? []) as ResolvedVolunteer[]).map((volunteer) => ({
    ...volunteer,
    seasons: byVolunteer.get(volunteer.id) ?? [],
  }));
}

/**
 * Volunteers who share a name with a portal account but are not linked, because
 * their emails differ or one of them has none.
 *
 * Deliberately not linked automatically: sharing a name is not evidence of
 * being the same person — the same reason the import rejects a NAME_MISMATCH
 * rather than merging. An admin confirms each one.
 */
export type LinkCandidate = { volunteer: ResolvedVolunteer; profile: Profile };

/**
 * Name-match pairs, split by whether an admin has already ruled them out as
 * different people. `rejected` stays reachable so a wrong call can be undone.
 */
export async function listLinkCandidates(): Promise<{
  pending: LinkCandidate[];
  rejected: LinkCandidate[];
}> {
  const supabase = createClient();
  const [volunteers, profiles, rejections] = await Promise.all([
    supabase.from("volunteers_resolved").select("*").is("profile_id", null),
    supabase.from("profiles").select("*"),
    supabase.from("volunteer_link_rejections").select("volunteer_id, profile_id"),
  ]);

  throwQueryError("读取志愿者", volunteers.error);
  throwQueryError("读取用户资料", profiles.error);
  throwQueryError("读取判定记录", rejections.error);

  const rejectedPairs = new Set(
    (rejections.data ?? []).map(
      (r: { volunteer_id: string; profile_id: string }) =>
        `${r.volunteer_id}:${r.profile_id}`,
    ),
  );

  const byName = new Map<string, Profile>();
  for (const profile of (profiles.data ?? []) as Profile[]) {
    const key = profile.full_name?.trim().toLowerCase();
    if (key) byName.set(key, profile);
  }

  const pairs = ((volunteers.data ?? []) as ResolvedVolunteer[])
    .map((volunteer) => ({
      volunteer,
      profile: byName.get(volunteer.name_key),
    }))
    .filter((pair): pair is LinkCandidate => Boolean(pair.profile));

  const isRejected = ({ volunteer, profile }: LinkCandidate) =>
    rejectedPairs.has(`${volunteer.id}:${profile.id}`);
  return {
    pending: pairs.filter((pair) => !isRejected(pair)),
    rejected: pairs.filter(isRejected),
  };
}

/** Marks a volunteer / account pair as different people (or, with `false`, undoes it). */
export async function setLinkRejected(
  volunteerId: string,
  profileId: string,
  rejected: boolean,
): Promise<void> {
  await adminJson<{ ok: true }>(
    "/api/admin/volunteers/link-rejection",
    rejected ? "POST" : "DELETE",
    { volunteer_id: volunteerId, profile_id: profileId },
    rejected ? "标记非同一人" : "撤销判定",
  );
}

/**
 * The signed-in user's own volunteer record, or null when the account is not
 * linked to one. Read through `volunteers_resolved` like everything else, so
 * the name and contact details already reflect the profile.
 */
export async function getMyVolunteer(
  profileId: string,
): Promise<ResolvedVolunteerWithSeasons | null> {
  const supabase = createClient();
  const volunteer = await supabase
    .from("volunteers_resolved")
    .select("*")
    .eq("profile_id", profileId)
    .maybeSingle();
  throwQueryError("读取志愿者信息", volunteer.error);
  if (!volunteer.data) return null;

  const seasons = await supabase
    .from("volunteer_seasons")
    .select("*")
    .eq("volunteer_id", (volunteer.data as ResolvedVolunteer).id)
    .order("created_at", { ascending: true });
  throwQueryError("读取志愿者季度", seasons.error);

  return {
    ...(volunteer.data as ResolvedVolunteer),
    seasons: (seasons.data ?? []) as VolunteerSeason[],
  };
}

/**
 * Moves the signed-in volunteer to another group for one of her seasons. The
 * function (migration 0016) checks the season is hers, refuses to leave a lead
 * without a group, and records the change in `volunteer_season_changes`.
 */
export async function setMyVolunteerGroup(
  seasonId: string,
  groupId: string | null,
): Promise<void> {
  const { error } = await createClient().rpc("set_my_volunteer_group", {
    p_season_id: seasonId,
    p_group_id: groupId,
  });
  if (error) {
    const reason = error.message.includes("LEAD_WITHOUT_GROUP")
      ? "负责人必须属于一个组别。"
      : error.message.includes("NOT_YOUR_SEASON")
        ? "只能修改自己的季度。"
        : error.message;
    throw new Error(`修改组别失败：${reason}`);
  }
}

/** Self-service group changes for one volunteer, newest first. Admin only (RLS). */
export async function listVolunteerSeasonChanges(
  volunteerId: string,
): Promise<VolunteerSeasonChange[]> {
  const { data, error } = await createClient()
    .from("volunteer_season_changes")
    .select("*")
    .eq("volunteer_id", volunteerId)
    .order("changed_at", { ascending: false });
  throwQueryError("读取修改记录", error);
  return (data ?? []) as VolunteerSeasonChange[];
}

/** Confirms (or, with `null`, removes) the link between a volunteer and an account. */
export function linkVolunteerProfile(
  id: string,
  profileId: string | null,
): Promise<ResolvedVolunteer> {
  return adminJson<ResolvedVolunteer>(
    "/api/admin/volunteers/link",
    "POST",
    { id, profile_id: profileId },
    profileId ? "关联门户账号" : "解除关联",
  );
}

export type VolunteerSeasonInput = {
  cohort_id: string;
  group_id: string | null;
  is_lead: boolean;
};

export type VolunteerInput = {
  full_name: string;
  email: string | null;
  wechat_number: string | null;
  notes: string | null;
  is_public: boolean;
  seasons: VolunteerSeasonInput[];
};

export function createVolunteer(
  input: VolunteerInput,
): Promise<VolunteerWithSeasons> {
  return postAdminJson<VolunteerWithSeasons>(
    "/api/admin/volunteers",
    input,
    "创建志愿者",
  );
}

export function updateVolunteer(
  id: string,
  input: VolunteerInput,
): Promise<VolunteerWithSeasons> {
  return adminJson<VolunteerWithSeasons>(
    "/api/admin/volunteers",
    "PATCH",
    { id, ...input },
    "更新志愿者",
  );
}

export function deleteVolunteer(id: string): Promise<{ id: string }> {
  return adminJson<{ id: string }>(
    "/api/admin/volunteers",
    "DELETE",
    { id },
    "删除志愿者",
  );
}

export type VolunteerGroupInput = {
  name: string;
  description: string | null;
  sort_order: number;
  includes_leads: boolean;
};

export function createVolunteerGroup(
  input: VolunteerGroupInput,
): Promise<VolunteerGroup> {
  return postAdminJson<VolunteerGroup>(
    "/api/admin/volunteer-groups",
    input,
    "创建组别",
  );
}

export function updateVolunteerGroup(
  id: string,
  input: VolunteerGroupInput,
): Promise<VolunteerGroup> {
  return adminJson<VolunteerGroup>(
    "/api/admin/volunteer-groups",
    "PATCH",
    { id, ...input },
    "更新组别",
  );
}

export function deleteVolunteerGroup(id: string): Promise<{ id: string }> {
  return adminJson<{ id: string }>(
    "/api/admin/volunteer-groups",
    "DELETE",
    { id },
    "删除组别",
  );
}

/** One row of a parsed Excel/CSV file. Seasons and groups are matched by name. */
export type VolunteerImportRow = {
  full_name: string;
  email: string | null;
  wechat_number: string | null;
  notes: string | null;
  is_public: boolean | null;
  seasons: { season: string; group: string | null; is_lead: boolean }[];
};

export type VolunteerImportEntry = {
  row: number;
  full_name: string;
  email: string | null;
  seasons: string[];
};

export type VolunteerImportError = {
  row: number;
  code: string;
  name?: string;
  value?: string;
  detail?: string;
  /** Chinese, actionable, written by the route handler. */
  message: string;
};

export type VolunteerImportResult = {
  ok: boolean;
  dry_run: boolean;
  errors: VolunteerImportError[];
  added: VolunteerImportEntry[];
  updated: VolunteerImportEntry[];
};

/**
 * `dryRun` validates and classifies every row without writing anything — the
 * preview step in the import UI. Either way a single bad row rejects the whole
 * file, so a partial import is not a state the roster can end up in.
 */
export function importVolunteers(
  rows: VolunteerImportRow[],
  options?: { dryRun?: boolean },
): Promise<VolunteerImportResult> {
  return postAdminJson<VolunteerImportResult>(
    "/api/admin/volunteers/import",
    { rows, dryRun: options?.dryRun ?? false },
    options?.dryRun ? "预检志愿者名单" : "导入志愿者名单",
  );
}

// Kept for compatibility with the prototype store API.
export function resetDemoData(): void {
  throw new Error("真实数据模式不支持重置演示数据");
}

// --- Unified member import -------------------------------------------------

/**
 * One row of the merged member spreadsheet. `invite` and `is_volunteer` are
 * what route it: the first decides whether a portal account is offered, the
 * second whether a volunteer roster record is kept. A row can do both.
 */
export type MemberImportRow = {
  full_name: string;
  email: string | null;
  wechat_number: string | null;
  notes: string | null;
  is_public: boolean | null;
  participant_role: ParticipantRole | null;
  is_admin: boolean;
  is_volunteer: boolean;
  invite: boolean;
  seasons: { season: string; group: string | null; is_lead: boolean }[];
};

export type MemberImportAction =
  | "INVITE_ADDED"
  | "INVITE_UPDATED"
  | "INVITE_ALREADY_CLAIMED"
  | "VOLUNTEER_ADDED"
  | "VOLUNTEER_UPDATED";

export type MemberImportPlan = {
  row: number;
  full_name: string;
  email: string | null;
  actions: MemberImportAction[];
  seasons: string[];
};

export type MemberImportResult = {
  ok: boolean;
  dry_run: boolean;
  errors: VolunteerImportError[];
  rows: MemberImportPlan[];
  summary: {
    invites_added: number;
    invites_updated: number;
    volunteers_added: number;
    volunteers_updated: number;
  };
};

/**
 * `dryRun` plans every row without writing — the preview step, which is where
 * an admin sees exactly who is about to be given a portal account. Either way a
 * single bad row rejects the whole file, across both tables.
 */
export function importMembers(
  rows: MemberImportRow[],
  options?: { dryRun?: boolean },
): Promise<MemberImportResult> {
  return postAdminJson<MemberImportResult>(
    "/api/admin/members/import",
    { rows, dryRun: options?.dryRun ?? false },
    options?.dryRun ? "预检成员名单" : "导入成员名单",
  );
}

// --- Tasks -----------------------------------------------------------------

/**
 * The signed-in user's assignments with their tasks, pending first. RLS lets
 * an admin read every row (migration 0017), so the admin case needs an
 * explicit filter here too — by account or through the linked volunteer
 * record — to avoid pulling in everyone else's assignments.
 */
export async function listMyTasks(userId: string): Promise<MyTask[]> {
  const supabase = createClient();
  const { error: syncError } = await supabase.rpc("sync_my_dynamic_task_assignments");
  // The catch-up is a safety net; a failure must not hide tasks already assigned.
  if (syncError) console.warn("同步任务失败", syncError.message);
  const { data: volunteerId } = await supabase.rpc("my_volunteer_id");
  let query = supabase.from("task_assignments").select("*, task:tasks(*)");
  query = volunteerId
    ? query.or(`profile_id.eq.${userId},volunteer_id.eq.${volunteerId}`)
    : query.eq("profile_id", userId);
  const { data, error } = await query
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });
  throwQueryError("读取任务", error);
  return ((data ?? []) as (MyTask & { task: Task | null })[]).filter(
    (row): row is MyTask => Boolean(row.task),
  );
}

/** Completes (or reopens) one of the caller's own assignments. */
export async function setMyTaskDone(assignmentId: string, done: boolean): Promise<void> {
  const { error } = await createClient().rpc("set_my_task_done", {
    p_assignment_id: assignmentId,
    p_done: done,
  });
  if (error) throw new Error(`更新任务失败：${error.message}`);
}

/** Every task with its recipients — admin only (RLS). Newest first. */
export async function listTasksWithAssignments(): Promise<TaskWithAssignments[]> {
  const { data, error } = await createClient()
    .from("tasks")
    .select("*, assignments:task_assignments(*)")
    .order("created_at", { ascending: false });
  throwQueryError("读取任务", error);
  return (data ?? []) as TaskWithAssignments[];
}

export type TaskInput = {
  title: string;
  description: string | null;
  link: string | null;
  due_on: string;
  cohort_id: string | null;
  /** Cohort-wide roles that receive this task now and when they join later. */
  audience_roles: ParticipantRole[];
  /** Every volunteer of the cohort, now and when they join later. */
  audience_volunteers: boolean;
  /** Narrows audience_volunteers to one group of the season. */
  audience_group_id: string | null;
  /** Volunteer records — the assignee resolves to an account through the link. */
  volunteer_ids: string[];
  /** Portal accounts (mentors, mentees) addressed directly. */
  profile_ids: string[];
};

export function createTask(input: TaskInput): Promise<TaskWithAssignments> {
  return postAdminJson<TaskWithAssignments>("/api/admin/tasks", input, "创建任务");
}

/**
 * Edits a published task. Recipients can only be added, never removed. Content
 * changes re-alert everyone who has not finished; `notifyAll` also re-alerts
 * those who have (their completion is kept).
 */
export function updateTask(
  id: string,
  input: TaskInput,
  notifyAll: boolean,
): Promise<TaskWithAssignments> {
  return adminJson<TaskWithAssignments>(
    "/api/admin/tasks",
    "PATCH",
    { id, ...input, notify_all: notifyAll },
    "修改任务",
  );
}

/** The member has opened 我的任务: clears every 新任务 / 已更新 mark. */
export async function markMyTasksSeen(): Promise<void> {
  const { error } = await createClient().rpc("mark_my_tasks_seen");
  if (error) throw new Error(`标记任务已读失败：${error.message}`);
}

export function deleteTask(id: string): Promise<{ id: string }> {
  return adminJson<{ id: string }>("/api/admin/tasks", "DELETE", { id }, "删除任务");
}

// ---------------------------------------------------------------------------
// Nickname change requests (migration 0021)
// ---------------------------------------------------------------------------

const nameChangeErrors: Record<string, string> = {
  INVALID_NAME: "请填写新的昵称（最多 200 字）。",
  REASON_REQUIRED: "请填写修改理由（最多 500 字）。",
  NAME_UNCHANGED: "新昵称与当前昵称相同。",
  REQUEST_ALREADY_PENDING: "你已有一条待审核的申请，请先等待结果或撤回。",
  REQUEST_ALREADY_REVIEWED: "这条申请已被处理，请刷新页面。",
  REQUEST_NOT_FOUND: "找不到这条申请，可能已被撤回。",
  REJECTION_NOTE_REQUIRED: "拒绝时请填写备注，方便申请人了解原因。",
  ADMIN_ONLY: "只有负责人可以审核。",
};

function throwNameChangeError(operation: string, error: SupabaseError | null): void {
  if (!error) return;
  const code = Object.keys(nameChangeErrors).find((key) =>
    error.message.includes(key),
  );
  throw new Error(code ? nameChangeErrors[code] : `${operation}失败：${error.message}`);
}

/** The signed-in user's own requests, newest first. */
export async function listMyNameChanges(
  profileId: string,
): Promise<NameChangeRequest[]> {
  const { data, error } = await createClient()
    .from("name_change_requests")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  throwQueryError("读取昵称修改申请", error);
  return (data ?? []) as NameChangeRequest[];
}

/** Admin view: every request still waiting, oldest first. */
export async function listPendingNameChanges(): Promise<NameChangeRequest[]> {
  const { data, error } = await createClient()
    .from("name_change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  throwQueryError("读取昵称修改申请", error);
  return (data ?? []) as NameChangeRequest[];
}

export async function requestNameChange(input: {
  requestedName: string;
  reason: string;
}): Promise<void> {
  const { error } = await createClient().rpc("request_name_change", {
    p_requested_name: input.requestedName,
    p_reason: input.reason,
  });
  throwNameChangeError("提交申请", error);
}

export async function withdrawNameChange(): Promise<void> {
  const { error } = await createClient().rpc("withdraw_name_change");
  throwNameChangeError("撤回申请", error);
}

export async function markNameChangesSeen(): Promise<void> {
  const { error } = await createClient().rpc("mark_name_changes_seen");
  throwNameChangeError("更新状态", error);
}

export async function reviewNameChange(input: {
  id: string;
  approve: boolean;
  note?: string;
}): Promise<void> {
  const { error } = await createClient().rpc("review_name_change", {
    p_request_id: input.id,
    p_approve: input.approve,
    p_note: input.note ?? null,
  });
  throwNameChangeError("审核", error);
}
