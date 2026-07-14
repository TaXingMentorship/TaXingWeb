"use client";

import type {
  BulletinBoard,
  BulletinCategory,
  BulletinPost,
  Cohort,
  Match,
  ParticipationRecord,
  Profile,
  RosterInvite,
  SessionLog,
  SessionType,
  UserRole,
} from "@/types/portal";
import { seedDb, type MockDb } from "@/lib/portal/mockData";

/**
 * Prototype data-access layer.
 *
 * Backed by localStorage so demo edits persist across reloads. Every function
 * is async and shaped like the eventual Supabase call so Phase B can swap the
 * implementation without changing the UI. No network, no auth.
 */

const STORAGE_KEY = "taxing-portal-demo-db";
const DB_VERSION = 6;
const VERSION_KEY = "taxing-portal-demo-db-version";

let memoryDb: MockDb | null = null;

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

function load(): MockDb {
  if (!hasWindow()) {
    memoryDb ??= seedDb();
    return memoryDb;
  }
  try {
    const storedVersion = Number(window.localStorage.getItem(VERSION_KEY));
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || storedVersion !== DB_VERSION) {
      const fresh = seedDb();
      save(fresh);
      return fresh;
    }
    return JSON.parse(raw) as MockDb;
  } catch {
    const fresh = seedDb();
    save(fresh);
    return fresh;
  }
}

function save(db: MockDb): void {
  memoryDb = db;
  if (!hasWindow()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  window.localStorage.setItem(VERSION_KEY, String(DB_VERSION));
}

/** Simulate a little network latency so loading states are visible in the demo. */
function delay<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// --- Cohorts ---------------------------------------------------------------

export async function listCohorts(): Promise<Cohort[]> {
  return delay(load().cohorts);
}

export async function getCohort(id: string): Promise<Cohort | null> {
  return delay(load().cohorts.find((c) => c.id === id) ?? null);
}

// --- Profiles --------------------------------------------------------------

export async function listProfiles(filter?: {
  role?: UserRole;
  cohortId?: string;
}): Promise<Profile[]> {
  let rows = load().profiles;
  if (filter?.role) rows = rows.filter((p) => p.role === filter.role);
  if (filter?.cohortId)
    rows = rows.filter((p) => p.cohort_ids.includes(filter.cohortId!));
  return delay(rows);
}

export async function getProfile(id: string): Promise<Profile | null> {
  return delay(load().profiles.find((p) => p.id === id) ?? null);
}

export async function updateProfile(
  id: string,
  patch: Partial<Omit<Profile, "id" | "role" | "created_at">>,
): Promise<Profile> {
  const db = load();
  const idx = db.profiles.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`找不到用户：${id}`);
  const updated: Profile = {
    ...db.profiles[idx],
    ...patch,
    updated_at: new Date().toISOString(),
  };
  db.profiles[idx] = updated;
  save(db);
  return delay(updated);
}

// --- Bulletin boards -------------------------------------------------------

export async function listBoards(filter?: {
  cohortIds?: string[];
}): Promise<BulletinBoard[]> {
  let rows = load().bulletin_boards;
  if (filter?.cohortIds) {
    const set = new Set(filter.cohortIds);
    rows = rows.filter((b) => set.has(b.cohort_id));
  }
  rows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return delay(rows);
}

export async function getBoard(id: string): Promise<BulletinBoard | null> {
  return delay(load().bulletin_boards.find((b) => b.id === id) ?? null);
}

export async function createBoard(input: {
  cohort_id: string;
  name: string;
  description: string | null;
  is_open: boolean;
}): Promise<BulletinBoard> {
  const db = load();
  const board: BulletinBoard = {
    id: uid("board"),
    cohort_id: input.cohort_id,
    name: input.name,
    description: input.description,
    is_open: input.is_open,
    created_at: new Date().toISOString(),
  };
  db.bulletin_boards.push(board);
  save(db);
  return delay(board);
}

/** Number of visible posts per board, keyed by board id. */
export async function countPostsByBoard(
  includeHidden = false,
): Promise<Record<string, number>> {
  const rows = load().bulletin_posts.filter(
    (p) => includeHidden || !p.hidden,
  );
  const counts: Record<string, number> = {};
  for (const p of rows) counts[p.board_id] = (counts[p.board_id] ?? 0) + 1;
  return delay(counts);
}

// --- Bulletin posts --------------------------------------------------------

export async function listPosts(filter?: {
  boardId?: string;
  cohortId?: string;
  includeHidden?: boolean;
}): Promise<BulletinPost[]> {
  let rows = load().bulletin_posts;
  if (filter?.boardId) rows = rows.filter((p) => p.board_id === filter.boardId);
  if (filter?.cohortId)
    rows = rows.filter((p) => p.cohort_id === filter.cohortId);
  if (!filter?.includeHidden) rows = rows.filter((p) => !p.hidden);
  rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(rows);
}

export async function createPost(input: {
  cohort_id: string;
  board_id: string;
  author_id: string;
  category: BulletinCategory;
  body: string;
}): Promise<BulletinPost> {
  const db = load();
  const post: BulletinPost = {
    id: uid("post"),
    cohort_id: input.cohort_id,
    board_id: input.board_id,
    author_id: input.author_id,
    category: input.category,
    body: input.body,
    hidden: false,
    created_at: new Date().toISOString(),
  };
  db.bulletin_posts.push(post);
  save(db);
  return delay(post);
}

export async function setPostHidden(
  id: string,
  hidden: boolean,
): Promise<BulletinPost> {
  const db = load();
  const idx = db.bulletin_posts.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`找不到帖子：${id}`);
  db.bulletin_posts[idx] = { ...db.bulletin_posts[idx], hidden };
  save(db);
  return delay(db.bulletin_posts[idx]);
}

export async function deletePost(id: string): Promise<void> {
  const db = load();
  db.bulletin_posts = db.bulletin_posts.filter((p) => p.id !== id);
  save(db);
  await delay(null);
}

// --- Sessions log ----------------------------------------------------------

export async function listSessions(filter?: {
  cohortId?: string;
  mentorId?: string;
  menteeId?: string;
}): Promise<SessionLog[]> {
  let rows = load().sessions_log;
  if (filter?.cohortId)
    rows = rows.filter((s) => s.cohort_id === filter.cohortId);
  if (filter?.mentorId) rows = rows.filter((s) => s.mentor_id === filter.mentorId);
  if (filter?.menteeId) rows = rows.filter((s) => s.mentee_id === filter.menteeId);
  rows = [...rows].sort((a, b) => b.session_date.localeCompare(a.session_date));
  return delay(rows);
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
  const db = load();
  const session: SessionLog = {
    id: uid("session"),
    ...input,
    created_at: new Date().toISOString(),
  };
  db.sessions_log.push(session);
  save(db);
  return delay(session);
}

export async function updateSession(
  id: string,
  patch: Partial<Omit<SessionLog, "id" | "created_at">>,
): Promise<SessionLog> {
  const db = load();
  const idx = db.sessions_log.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error(`找不到记录：${id}`);
  db.sessions_log[idx] = { ...db.sessions_log[idx], ...patch };
  save(db);
  return delay(db.sessions_log[idx]);
}

export async function deleteSession(id: string): Promise<void> {
  const db = load();
  db.sessions_log = db.sessions_log.filter((s) => s.id !== id);
  save(db);
  await delay(null);
}

// --- Participation records (mentee) ----------------------------------------

export async function listParticipation(filter?: {
  cohortId?: string;
  menteeId?: string;
}): Promise<ParticipationRecord[]> {
  let rows = load().participation_records;
  if (filter?.cohortId)
    rows = rows.filter((r) => r.cohort_id === filter.cohortId);
  if (filter?.menteeId)
    rows = rows.filter((r) => r.mentee_id === filter.menteeId);
  rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(rows);
}

export async function createParticipation(input: {
  cohort_id: string;
  mentee_id: string;
  event_name: string;
  screenshot_name: string | null;
  screenshot_url: string | null;
}): Promise<ParticipationRecord> {
  const db = load();
  const record: ParticipationRecord = {
    id: uid("participation"),
    ...input,
    created_at: new Date().toISOString(),
  };
  db.participation_records.push(record);
  save(db);
  return delay(record);
}

export async function deleteParticipation(id: string): Promise<void> {
  const db = load();
  db.participation_records = db.participation_records.filter((r) => r.id !== id);
  save(db);
  await delay(null);
}

// --- Roster import ---------------------------------------------------------

export type RosterRowInput = {
  email: string;
  full_name: string;
  role: string;
};

export type ImportResult = {
  added: RosterInvite[];
  skipped: { row: RosterRowInput; reason: string }[];
  errors: { row: RosterRowInput; reason: string }[];
};

const VALID_ROLES: UserRole[] = ["admin", "mentor", "mentee"];

export async function importRoster(
  cohortId: string,
  rows: RosterRowInput[],
): Promise<ImportResult> {
  const db = load();
  const result: ImportResult = { added: [], skipped: [], errors: [] };
  const existingEmails = new Set(
    db.profiles.map((p) => (p.email ?? "").toLowerCase()),
  );
  const invitedEmails = new Set(
    db.roster_invites
      .filter((r) => r.cohort_id === cohortId)
      .map((r) => r.email.toLowerCase()),
  );

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase() ?? "";
    const fullName = row.full_name?.trim() ?? "";
    const role = row.role?.trim().toLowerCase() ?? "";

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      result.errors.push({ row, reason: "邮箱格式无效" });
      continue;
    }
    if (!VALID_ROLES.includes(role as UserRole)) {
      result.errors.push({ row, reason: `角色无效（应为 mentor 或 mentee）` });
      continue;
    }
    if (existingEmails.has(email) || invitedEmails.has(email)) {
      result.skipped.push({ row, reason: "该邮箱已在名单中" });
      continue;
    }

    const invite: RosterInvite = {
      id: uid("invite"),
      cohort_id: cohortId,
      email,
      full_name: fullName || null,
      role: role as UserRole,
      invited_at: new Date().toISOString(),
      claimed_user_id: null,
    };
    db.roster_invites.push(invite);
    invitedEmails.add(email);

    // In the prototype we also materialize a profile so imported people show
    // up immediately in the directory (Phase B creates this on first login).
    const profile: Profile = {
      id: uid("user"),
      role: invite.role,
      cohort_ids: [cohortId],
      full_name: invite.full_name,
      email,
      wechat_number: null,
      bio: null,
      field: null,
      background: null,
      interests: [],
      goals: null,
      linkedin: null,
      avatar_url: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(
        email,
      )}`,
      visible: true,
      years_experience: null,
      mentee_capacity: null,
      mentee_expectations: null,
      topics: null,
      help_needed: null,
      admin_notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.profiles.push(profile);
    existingEmails.add(email);

    result.added.push(invite);
  }

  save(db);
  return delay(result);
}

export async function listRosterInvites(
  cohortId?: string,
): Promise<RosterInvite[]> {
  let rows = load().roster_invites;
  if (cohortId) rows = rows.filter((r) => r.cohort_id === cohortId);
  return delay(rows);
}

// --- Matching --------------------------------------------------------------

export async function listMatches(filter?: {
  cohortId?: string;
  mentorId?: string;
  menteeId?: string;
}): Promise<Match[]> {
  let rows = load().matches;
  if (filter?.cohortId) rows = rows.filter((m) => m.cohort_id === filter.cohortId);
  if (filter?.mentorId) rows = rows.filter((m) => m.mentor_id === filter.mentorId);
  if (filter?.menteeId) rows = rows.filter((m) => m.mentee_id === filter.menteeId);
  return delay(rows);
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
  const db = load();
  const result: MatchImportResult = { added: [], skipped: [], errors: [] };
  const profileById = new Map(db.profiles.map((p) => [p.id, p]));
  const existingPairs = new Set(
    db.matches
      .filter((m) => m.cohort_id === cohortId)
      .map((m) => `${m.mentor_id}__${m.mentee_id}`),
  );

  for (const row of rows) {
    const mentorId = row.mentor_id?.trim() ?? "";
    const menteeId = row.mentee_id?.trim() ?? "";

    if (!mentorId || !menteeId) {
      result.errors.push({ row, reason: "mentor_id 或 mentee_id 为空" });
      continue;
    }
    const mentor = profileById.get(mentorId);
    const mentee = profileById.get(menteeId);
    if (!mentor || mentor.role !== "mentor" || !mentor.cohort_ids.includes(cohortId)) {
      result.errors.push({ row, reason: `导师 ID 无效或不属于该项目：${mentorId}` });
      continue;
    }
    if (!mentee || mentee.role !== "mentee" || !mentee.cohort_ids.includes(cohortId)) {
      result.errors.push({ row, reason: `学员 ID 无效或不属于该项目：${menteeId}` });
      continue;
    }
    const key = `${mentorId}__${menteeId}`;
    if (existingPairs.has(key)) {
      result.skipped.push({ row, reason: "该配对已存在" });
      continue;
    }

    const match: Match = {
      id: uid("match"),
      cohort_id: cohortId,
      mentor_id: mentorId,
      mentee_id: menteeId,
      created_at: new Date().toISOString(),
    };
    db.matches.push(match);
    existingPairs.add(key);
    result.added.push(match);
  }

  save(db);
  return delay(result);
}

// --- Demo controls ---------------------------------------------------------

export function resetDemoData(): void {
  save(seedDb());
}
