// Pure logic behind the admin roster table and the 待激活 list: which rows
// exist, how they are filtered, and who a bulk action may touch. No React and
// no runtime imports, so it can be unit-tested directly (tests/).
import type {
  MentorRecommendation,
  Profile,
  RosterInvite,
  RosterNoteEntry,
} from "../../types/portal";

export type MemberRowData = {
  profile: Profile;
  /** Searchable text of the note thread (bodies and author names). */
  notes?: string | null;
  noteEntries?: RosterNoteEntry[];
  /** Every recommendation of this mentor, all seasons. */
  recommendations?: MentorRecommendation[];
  sessionCount: number;
  submitted: boolean | null;
  gaveGratitude: boolean | null;
  /** null when completion does not apply (no mentor / mentee role). */
  completedAll: boolean | null;
};

export type InviteState = "setup" | "account" | "waiting" | "out";

export type RosterEntry =
  | { kind: "member"; row: MemberRowData }
  | { kind: "invited"; invite: RosterInvite; state: InviteState };

export type ClassifiedInvite = { invite: RosterInvite; state: InviteState };

const emailKey = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

/**
 * Is the invite's person already listed in the invite's season? Once an
 * account exists, the account is the only authority on who someone is: the
 * invite only carried identity and season into the account at activation, and
 * is history after that. So only the account's seasons are consulted, never
 * the invite's participant_role (an admin may have changed the identity on the
 * web since).
 */
const isListed = (p: Profile, invite: RosterInvite) =>
  p.cohort_ids.includes(invite.cohort_id);

/**
 * What an invite means, judged against the accounts that exist. Both lists use
 * this one function so they cannot disagree about the same person.
 *
 * Activation is two steps (the code creates the account and claims the invite;
 * onboarding creates the profile), and an account only carries the seasons it
 * was given. So:
 *
 *  - "setup":   claimed, but no profile yet → activated, profile not filled in.
 *  - "account":  the person has an account (the invite is claimed by it, or the
 *                email matches one) that does not list this season. 0035 stops
 *                imports producing this; the state stays so a person can never
 *                silently fall out of both lists.
 *  - "waiting": unclaimed, no account → has not signed in.
 *  - "out":     flagged as not taking part (checked before "account").
 *  - null:      nothing to show: already listed in the season.
 */
export function classifyInvites(
  invites: RosterInvite[],
  profiles: Profile[],
): ClassifiedInvite[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const profileByEmail = new Map(profiles.map((p) => [emailKey(p.email), p]));
  const order: Record<InviteState, number> = {
    setup: 0,
    account: 1,
    waiting: 2,
    out: 3,
  };

  return invites
    .flatMap((invite): ClassifiedInvite[] => {
      const account = invite.claimed_user_id
        ? profileById.get(invite.claimed_user_id)
        : profileByEmail.get(emailKey(invite.email));
      if (!account) {
        const state: InviteState = invite.claimed_user_id
          ? "setup"
          : invite.not_participating
            ? "out"
            : "waiting";
        return [{ invite, state }];
      }
      if (isListed(account, invite)) return [];
      const state: InviteState = invite.not_participating
        ? "out"
        : "account";
      return [{ invite, state }];
    })
    .sort((a, b) => order[a.state] - order[b.state]);
}

/**
 * Invites that get a row of their own beside the profile rows of one season.
 * `profiles` is undefined while it is still loading: nothing is classified
 * then, so rows do not flash in and out.
 */
export function inviteRows(
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): ClassifiedInvite[] {
  return profiles ? classifyInvites(invites, profiles) : [];
}

export function buildEntries(
  rows: MemberRowData[],
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): RosterEntry[] {
  return [
    ...rows.map((row): RosterEntry => ({ kind: "member", row })),
    ...inviteRows(invites, profiles).map(
      ({ invite, state }): RosterEntry => ({ kind: "invited", invite, state }),
    ),
  ];
}

/**
 * Invites across all seasons whose person is not yet part of that season:
 * waiting, flagged out, or holding an account that does not list the season.
 * "setup" people (account created, profile not filled in) are not here: they
 * have signed in, and the roster table shows them.
 */
export function pendingInvites(
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): ClassifiedInvite[] {
  return inviteRows(invites, profiles).filter((item) => item.state !== "setup");
}

export type RosterFilters = {
  search: string;
  /** Any of these identities matches. Empty = all. */
  role: RosterRole[];
  /** Any of these states matches. Empty = all. */
  status: RosterStatus[];
  done: "all" | "done" | "todo";
  /** 活动记录 submitted? Mentees only; everyone else drops out once it is set. */
  activity: "all" | "done" | "todo";
  /** 感谢赠言 given? Mentees only; everyone else drops out once it is set. */
  gratitude: "all" | "done" | "todo";
  /** "none" (unassigned) and/or group ids; any of them matches. Empty = all. */
  group: string[];
} & Partial<NoteFilters>;

export type RosterRole = "mentor" | "mentee" | "volunteer" | "admin";
export type RosterStatus = "active" | "setup" | "account" | "waiting" | "out";

/** Filters over the staff-only columns, shared by the admin and volunteer views. */
export type NoteFilters = {
  note: "all" | "has" | "none";
  /** Author ids (LEGACY_AUTHOR for carried-over notes); any of them matches. Empty = all. */
  noteAuthor: string[];
  recommend: "all" | "current" | "past" | "mine";
  /** The real account viewing: "mine" means recommended by them. */
  viewerId: string | null;
  /** The season shown: "current" means recommended in it. */
  cohortId: string;
};

export const LEGACY_AUTHOR = "__legacy";

export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Searchable text of a note thread. */
export function noteSearchText(entries: RosterNoteEntry[]): string {
  return entries.flatMap((e) => [e.body, e.author_name ?? ""]).join(" ");
}

/** Does a member pass the note / recommendation filters? Unset means "all". */
export function matchesNoteFilters(
  row: Pick<MemberRowData, "profile" | "noteEntries" | "recommendations">,
  filters: Partial<NoteFilters>,
): boolean {
  const entries = row.noteEntries ?? [];
  const note = filters.note ?? "all";
  if (note === "has" && entries.length === 0) return false;
  if (note === "none" && entries.length > 0) return false;

  const authors = filters.noteAuthor ?? [];
  if (authors.length > 0) {
    const want = new Set(authors);
    if (!entries.some((e) => want.has(e.author_id ?? LEGACY_AUTHOR))) return false;
  }

  const recommend = filters.recommend ?? "all";
  if (recommend !== "all") {
    // Only mentors can be recommended.
    if (row.profile.participant_role !== "mentor") return false;
    const recs = row.recommendations ?? [];
    const ok =
      recommend === "current"
        ? recs.some((r) => r.cohort_id === filters.cohortId)
        : recommend === "past"
          ? recs.some((r) => r.cohort_id !== filters.cohortId)
          : recs.some((r) => r.recommender_id === filters.viewerId);
    if (!ok) return false;
  }
  return true;
}

const noteFiltersActive = (f: Partial<NoteFilters>) =>
  (f.note ?? "all") !== "all" ||
  (f.noteAuthor ?? []).length > 0 ||
  (f.recommend ?? "all") !== "all";

/** Note authors seen in a season's threads with their entry counts, most first. */
export function noteAuthors(
  entries: RosterNoteEntry[],
): { id: string; name: string | null; count: number }[] {
  const seen = new Map<string, { id: string; name: string | null; count: number }>();
  for (const e of entries) {
    const id = e.author_id ?? LEGACY_AUTHOR;
    const item = seen.get(id) ?? { id, name: e.author_name, count: 0 };
    item.count += 1;
    seen.set(id, item);
  }
  return [...seen.values()].sort((a, b) => b.count - a.count);
}

function identityOf(entry: RosterEntry) {
  if (entry.kind === "member") {
    const p = entry.row.profile;
    return {
      name: p.full_name,
      email: p.email,
      wechat: p.wechat_number,
      notes: entry.row.notes,
      mentor: p.participant_role === "mentor",
      mentee: p.participant_role === "mentee",
      volunteer: p.is_volunteer,
      admin: p.is_admin,
    };
  }
  const i = entry.invite;
  return {
    name: i.full_name,
    email: i.email,
    wechat: null,
    notes: null,
    mentor: i.participant_role === "mentor",
    mentee: i.participant_role === "mentee",
    volunteer: i.is_volunteer,
    admin: i.is_admin,
  };
}

export function filterEntries(
  entries: RosterEntry[],
  filters: RosterFilters,
  groupOfMentor: Map<string, string>,
): RosterEntry[] {
  const q = filters.search.trim().toLowerCase();
  return entries.filter((entry) => {
    const id = identityOf(entry);
    if (q) {
      const haystack = [id.name, id.email, id.wechat, id.notes]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.role.length > 0 && !filters.role.some((r) => id[r])) return false;

    // Notes and recommendations only exist for activated members.
    if (noteFiltersActive(filters)) {
      if (entry.kind !== "member" || !matchesNoteFilters(entry.row, filters)) return false;
    }

    // Answer groups only exist for activated mentors.
    if (filters.group.length > 0) {
      if (entry.kind !== "member" || entry.row.profile.participant_role !== "mentor") {
        return false;
      }
      const groupId = groupOfMentor.get(entry.row.profile.id);
      const hit = groupId ? filters.group.includes(groupId) : filters.group.includes("none");
      if (!hit) return false;
    }

    const state = entry.kind === "invited" ? entry.state : null;
    if (filters.status.length > 0 && !filters.status.some((s) => matchesStatus(entry, state, s))) {
      return false;
    }

    // Completion is about activity records; someone with no profile has none,
    // so the filter only speaks about activated members.
    if (filters.done !== "all") {
      if (entry.kind !== "member") return false;
      // No mentor / mentee role: completion does not apply.
      if (entry.row.completedAll === null) return false;
      if (filters.done === "done" && !entry.row.completedAll) return false;
      if (filters.done === "todo" && entry.row.completedAll) return false;
    }

    if (!matchesFlag(entry, "submitted", filters.activity)) return false;
    if (!matchesFlag(entry, "gaveGratitude", filters.gratitude)) return false;
    return true;
  });
}

// 已激活 covers both finished and unfinished onboarding.
function matchesStatus(entry: RosterEntry, state: string | null, status: RosterStatus): boolean {
  if (status === "active") return entry.kind === "member" || state === "setup";
  return state === status;
}

// A per-item completion filter. The flag is null when it does not apply
// (non-mentees) and invites have no records, so both fail any active filter.
function matchesFlag(
  entry: RosterEntry,
  key: "submitted" | "gaveGratitude",
  want: "all" | "done" | "todo",
): boolean {
  if (want === "all") return true;
  if (entry.kind !== "member") return false;
  const value = entry.row[key];
  if (value === null) return false;
  return want === "done" ? value : !value;
}

/**
 * The shown entries an export lists. People flagged 不参与本次项目 are not
 * part of the season, so they stay out unless the status filter asks for them.
 */
export function exportEntries(
  entries: RosterEntry[],
  status: RosterFilters["status"],
): RosterEntry[] {
  if (status.includes("out")) return entries;
  return entries.filter((e) => !(e.kind === "invited" && e.state === "out"));
}

/** Display names of the entries shown, in table order; blanks are dropped. */
export function rosterNames(entries: RosterEntry[]): string[] {
  return entries
    .map((e) => (e.kind === "member" ? e.row.profile.full_name : e.invite.full_name))
    .map((n) => (n ?? "").trim())
    .filter((n) => n !== "");
}

/**
 * The mentors a bulk action may touch: those currently visible after
 * filtering. "Select all" must mean "all of these", never every mentor of the
 * season — a mentor the filter has hidden is not something the admin looked at.
 */
export function selectableMentorIds(entries: RosterEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.kind === "member" && entry.row.profile.participant_role === "mentor"
      ? [entry.row.profile.id]
      : [],
  );
}
