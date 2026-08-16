"use client";

import { createClient } from "@/lib/supabase/client";
import type {
  BulletinBoard,
  BulletinCategory,
  BulletinPost,
  Cohort,
  Match,
  ParticipationRecord,
  ParticipantRole,
  Profile,
  RosterInvite,
  SessionLog,
  SessionType,
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

export async function listCohorts(): Promise<Cohort[]> {
  const { data, error } = await createClient()
    .from("cohorts")
    .select("*")
    .order("created_at", { ascending: true });
  throwQueryError("读取项目", error);
  return (data ?? []) as Cohort[];
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

  const { data, error } = await query.order("created_at", { ascending: true });
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
}): Promise<BulletinBoard> {
  const { data, error } = await createClient()
    .from("bulletin_boards")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("创建留言板", error);
  return data as BulletinBoard;
}

/** Number of RLS-visible posts per board, keyed by board id. */
export async function countPostsByBoard(
  includeHidden = false,
): Promise<Record<string, number>> {
  let query = createClient().from("bulletin_posts").select("board_id");
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
  let query = createClient().from("bulletin_posts").select("*");
  if (filter?.boardId) query = query.eq("board_id", filter.boardId);
  if (filter?.cohortId) query = query.eq("cohort_id", filter.cohortId);
  if (!filter?.includeHidden) query = query.eq("hidden", false);

  const { data, error } = await query.order("created_at", { ascending: false });
  throwQueryError("读取留言", error);
  return (data ?? []) as BulletinPost[];
}

export async function createPost(input: {
  cohort_id: string;
  board_id: string;
  author_id: string;
  category: BulletinCategory;
  body: string;
}): Promise<BulletinPost> {
  const { data, error } = await createClient()
    .from("bulletin_posts")
    .insert(input)
    .select("*")
    .single();
  throwQueryError("发布留言", error);
  return data as BulletinPost;
}

export async function setPostHidden(
  id: string,
  hidden: boolean,
): Promise<BulletinPost> {
  return adminJson<BulletinPost>(
    "/api/admin/moderation",
    "PATCH",
    { id, hidden },
    "更新留言状态",
  );
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await createClient()
    .from("bulletin_posts")
    .delete()
    .eq("id", id);
  throwQueryError("删除留言", error);
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

// Kept for compatibility with the prototype store API.
export function resetDemoData(): void {
  throw new Error("真实数据模式不支持重置演示数据");
}
