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
  Match,
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
  VolunteerWithSeasons,
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
}): Promise<BulletinBoard> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("创建留言板", error);
  return data as BulletinBoard;
}

/** Individual board switch; the cohort switch remains the global override. */
export async function setBoardOpen(
  id: string,
  open: boolean,
): Promise<BulletinBoard> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .update({ is_open: open })
    .eq("id", id)
    .select("*")
    .single();
  throwQueryError("更新留言板", error);
  return data as BulletinBoard;
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
export async function listLinkCandidates(): Promise<
  { volunteer: ResolvedVolunteer; profile: Profile }[]
> {
  const supabase = createClient();
  const [volunteers, profiles] = await Promise.all([
    supabase.from("volunteers_resolved").select("*").is("profile_id", null),
    supabase.from("profiles").select("*"),
  ]);

  throwQueryError("读取志愿者", volunteers.error);
  throwQueryError("读取用户资料", profiles.error);

  const byName = new Map<string, Profile>();
  for (const profile of (profiles.data ?? []) as Profile[]) {
    const key = profile.full_name?.trim().toLowerCase();
    if (key) byName.set(key, profile);
  }

  return ((volunteers.data ?? []) as ResolvedVolunteer[])
    .map((volunteer) => ({
      volunteer,
      profile: byName.get(volunteer.name_key),
    }))
    .filter(
      (pair): pair is { volunteer: ResolvedVolunteer; profile: Profile } =>
        Boolean(pair.profile),
    );
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
