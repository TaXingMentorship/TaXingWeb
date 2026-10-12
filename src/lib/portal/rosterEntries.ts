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

export type InviteState = "setup" | "account" | "waiting" | "out";

export type RosterEntry =
  | { kind: "member"; row: MemberRowData }
  | { kind: "invited"; invite: RosterInvite; state: InviteState };

export type ClassifiedInvite = { invite: RosterInvite; state: InviteState };

const emailKey = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

/** A member of a season is a participant (mentor / mentee) listed in it. */
const isMemberOf = (p: Profile, cohortId: string) =>
  p.participant_role !== null && p.cohort_ids.includes(cohortId);

/**
 * What an invite means, judged against the accounts that exist. Both lists use
 * this one function so they cannot disagree about the same person.
 *
 * Activation is two steps (the code creates the account and claims the invite;
 * onboarding creates the profile), and importing a roster does not add the new
 * season to an account that already exists. So:
 *
 *  - "setup":   claimed, but no profile yet → activated, profile not filled in.
 *  - "account": unclaimed, but the email already has an account that is not a
 *               member of this invite's season → has an account, not in this
 *               season (the import never added it).
 *  - "waiting": unclaimed, no account → has not signed in.
 *  - "out":     flagged as not taking part (and not already an account holder
 *               who is a member — that person is simply a member).
 *  - null:      nothing to show: the person is already listed as a member of
 *               the season, or is claimed with a profile.
 */
export function classifyInvites(
  invites: RosterInvite[],
  profiles: Profile[],
): ClassifiedInvite[] {
  const profileIds = new Set(profiles.map((p) => p.id));
  const byEmail = new Map(profiles.map((p) => [emailKey(p.email), p]));
  const order: Record<InviteState, number> = { setup: 0, account: 1, waiting: 2, out: 3 };

  return invites
    .flatMap((invite): ClassifiedInvite[] => {
      if (invite.claimed_user_id) {
        return profileIds.has(invite.claimed_user_id) ? [] : [{ invite, state: "setup" }];
      }
      const account = byEmail.get(emailKey(invite.email));
      if (!account) return [{ invite, state: invite.not_participating ? "out" : "waiting" }];
      if (isMemberOf(account, invite.cohort_id)) return [];
      return [{ invite, state: invite.not_participating ? "out" : "account" }];
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
 * Invites across all seasons whose person has not completed activation:
 * waiting, flagged out, or holding an account that is not in that season.
 * Claimed invites are not pending.
 */
export function pendingInvites(
  invites: RosterInvite[],
  profiles: Profile[] | undefined,
): ClassifiedInvite[] {
  return inviteRows(
    invites.filter((i) => !i.claimed_user_id),
    profiles,
  );
}

export type RosterFilters = {
  search: string;
  role: "all" | "mentor" | "mentee" | "volunteer" | "admin";
  status: "all" | "active" | "setup" | "account" | "waiting" | "out";
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

    const state = entry.kind === "invited" ? entry.state : null;
    // 已激活 covers both finished and unfinished onboarding.
    if (filters.status === "active" && entry.kind !== "member" && state !== "setup") return false;
    if (filters.status !== "all" && filters.status !== "active" && state !== filters.status) {
      return false;
    }

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
