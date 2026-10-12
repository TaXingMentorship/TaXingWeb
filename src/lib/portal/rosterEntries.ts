// Pure logic behind the admin roster table and the 待激活 list: which rows
// exist, how they are filtered, and who a bulk action may touch. No React and
// no runtime imports, so it can be unit-tested directly (tests/).
import type { Profile, RosterInvite } from "../../types/portal";

export type MemberRowData = {
  profile: Profile;
  sessionCount: number;
  submitted: boolean | null;
  gaveGratitude: boolean | null;
  completedAll: boolean;
};

export type RosterEntry =
  | { kind: "member"; row: MemberRowData }
  | { kind: "invited"; invite: RosterInvite };

export type InviteState = "setup" | "out" | "waiting";

/**
 * Activation is two steps: the code creates the account and claims the invite,
 * onboarding creates the profile. So a claimed invite is "setup" (activated,
 * profile not yet filled in), an unclaimed one is still waiting, or flagged out.
 */
export function inviteState(invite: RosterInvite): InviteState {
  if (invite.claimed_user_id) return "setup";
  return invite.not_participating ? "out" : "waiting";
}

const emailKey = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

const byParticipation = (a: RosterInvite, b: RosterInvite) =>
  Number(a.not_participating) - Number(b.not_participating);

/**
 * Invites that get a row of their own beside the profile rows of one season.
 *
 *  - "setup": claimed, but no profile exists yet → 已激活 · 待填资料.
 *  - "waiting"/"out": unclaimed. If the same email already has a profile that
 *    is a member of this season, the person is already shown as a member and
 *    the stale invite is dropped, otherwise they would appear twice (an
 *    existing account re-imported into a new season leaves its invite
 *    unclaimed).
 *
 * `profiles` is undefined while it is still loading: nothing is classified
 * then, so rows do not flash in and out.
 */
export function inviteRows(
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
  memberProfiles: Profile[],
): RosterInvite[] {
  if (!profiles) return [];
  const profileIds = new Set(profiles.map((p) => p.id));
  const memberEmails = new Set(memberProfiles.map((p) => emailKey(p.email)));

  const setup = invites.filter(
    (i) => i.claimed_user_id && !profileIds.has(i.claimed_user_id),
  );
  const unclaimed = invites
    .filter((i) => !i.claimed_user_id && !memberEmails.has(emailKey(i.email)))
    .sort(byParticipation);
  return [...setup, ...unclaimed];
}

export function buildEntries(
  rows: MemberRowData[],
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): RosterEntry[] {
  return [
    ...rows.map((row): RosterEntry => ({ kind: "member", row })),
    ...inviteRows(
      invites,
      profiles,
      rows.map((r) => r.profile),
    ).map((invite): RosterEntry => ({ kind: "invited", invite })),
  ];
}

/**
 * Invites across all seasons whose person has not signed in. Someone whose
 * email already has a profile has signed in, so an unclaimed invite for them
 * (a re-import into a new season) is not "waiting" and must not be counted.
 */
export function pendingInvites(
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): RosterInvite[] {
  const known = new Set((profiles ?? []).map((p) => emailKey(p.email)));
  return invites
    .filter((i) => !i.claimed_user_id && !known.has(emailKey(i.email)))
    .sort(byParticipation);
}

export type RosterFilters = {
  search: string;
  role: "all" | "mentor" | "mentee" | "volunteer" | "admin";
  status: "all" | "active" | "setup" | "waiting" | "out";
  done: "all" | "done" | "todo";
  /** "all", "none" (unassigned) or a group id. */
  group: string;
};

function identityOf(entry: RosterEntry) {
  if (entry.kind === "member") {
    const p = entry.row.profile;
    return {
      name: p.full_name,
      email: p.email,
      wechat: p.wechat_number,
      notes: p.admin_notes,
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
    if (filters.role !== "all" && !id[filters.role]) return false;

    // Answer groups only exist for activated mentors.
    if (filters.group !== "all") {
      if (entry.kind !== "member" || entry.row.profile.participant_role !== "mentor") {
        return false;
      }
      const groupId = groupOfMentor.get(entry.row.profile.id);
      if (filters.group === "none" ? Boolean(groupId) : groupId !== filters.group) {
        return false;
      }
    }

    const state = entry.kind === "invited" ? inviteState(entry.invite) : null;
    // 已激活 covers both finished and unfinished onboarding.
    if (filters.status === "active" && entry.kind !== "member" && state !== "setup") return false;
    if (filters.status === "setup" && state !== "setup") return false;
    if (filters.status === "waiting" && state !== "waiting") return false;
    if (filters.status === "out" && state !== "out") return false;

    // Completion is about activity records; someone with no profile has none,
    // so the filter only speaks about activated members.
    if (filters.done !== "all") {
      if (entry.kind !== "member") return false;
      if (filters.done === "done" && !entry.row.completedAll) return false;
      if (filters.done === "todo" && entry.row.completedAll) return false;
    }
    return true;
  });
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
