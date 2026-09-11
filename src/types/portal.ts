export type ParticipantRole = "mentor" | "mentee";
export type UserRole = "admin" | ParticipantRole;

export type BulletinCategory =
  | "wish"
  | "thanks"
  | "growth"
  | "question"
  | "feedback"
  | "expectation"
  | "reflection"
  | "other";

export type BulletinColor =
  | "default"
  | "yellow"
  | "pink"
  | "blue"
  | "green"
  | "purple"
  | "orange";

export type SessionType = "mentorship" | "gratitude";

export type BulletinBoard = {
  id: string;
  cohort_id: string;
  name: string;
  description: string | null;
  is_open: boolean;
  /** null means every category is allowed on this board. */
  allowed_categories: BulletinCategory[] | null;
  allow_anonymous: boolean;
  allow_comments: boolean;
  /** Prompt shown in the composer and the empty state. */
  prompt: string | null;
  sort_order: number;
  created_at: string;
};

export type Cohort = {
  id: string;
  name: string;
  starts_at: string | null;
  ends_at: string | null;
  bulletin_open: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  participant_role: ParticipantRole | null;
  is_admin: boolean;
  is_volunteer: boolean;
  cohort_ids: string[];
  full_name: string | null;
  email: string | null;
  wechat_number: string | null;
  bio: string | null;
  field: string | null;
  background: string | null;
  interests: string[];
  linkedin: string | null;
  avatar_url: string | null;
  visible: boolean;
  // Mentor-only fields
  years_experience: string | null;
  mentee_capacity: string | null;
  mentee_expectations: string | null;
  topics: string | null;
  // Mentee-only field
  help_needed: string | null;
  // Admin roster note (only field editable directly on the website)
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  cohort_id: string;
  mentor_id: string;
  mentee_id: string;
  created_at: string;
};

export type RosterInvite = {
  id: string;
  cohort_id: string;
  email: string;
  full_name: string | null;
  participant_role: ParticipantRole | null;
  is_admin: boolean;
  is_volunteer: boolean;
  invited_at: string;
  claimed_user_id: string | null;
};

export type BulletinPost = {
  id: string;
  cohort_id: string;
  board_id: string;
  /**
   * null when the row is anonymous and you are neither its author nor an
   * admin — the 0009 views mask it before it leaves the database.
   */
  author_id: string | null;
  category: BulletinCategory;
  title: string | null;
  body: string;
  /**
   * Enforced in the database since migration 0009: the readable views null out
   * `author_id` for everyone except the author and admins.
   */
  is_anonymous: boolean;
  color: BulletinColor;
  pinned: boolean;
  resolved: boolean;
  hidden: boolean;
  created_at: string;
};

export type BulletinComment = {
  id: string;
  post_id: string;
  cohort_id: string;
  /** Masked to null for anonymous rows — see BulletinPost.author_id. */
  author_id: string | null;
  body: string;
  is_anonymous: boolean;
  hidden: boolean;
  created_at: string;
};

export type BulletinReaction = {
  id: string;
  post_id: string;
  cohort_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type SessionLog = {
  id: string;
  cohort_id: string;
  mentor_id: string;
  mentee_id: string;
  session_type: SessionType;
  session_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type ParticipationRecord = {
  id: string;
  cohort_id: string;
  mentee_id: string;
  event_name: string;
  screenshot_name: string | null;
  screenshot_url: string | null;
  screenshot_path: string | null;
  created_at: string;
};

// --- Volunteers ------------------------------------------------------------

export type VolunteerGroup = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  /** Automatically contains every lead, not only its own members. */
  includes_leads: boolean;
  created_at: string;
};

/**
 * A person who has helped run a season. Distinct from `Profile`: almost no
 * volunteer has a portal account, and `profile_id` is the optional link for the
 * ones who do.
 *
 * `name_key` and `email_key` are database-generated and read-only — they are
 * the deduplication keys the Excel import matches on (email first, name second).
 */
export type Volunteer = {
  id: string;
  full_name: string;
  name_key: string;
  email: string | null;
  email_key: string | null;
  wechat_number: string | null;
  notes: string | null;
  /** Whether this volunteer appears in the public /about acknowledgement list. */
  is_public: boolean;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Group membership is per season, so moving groups is recorded, not overwritten. */
export type VolunteerSeason = {
  id: string;
  volunteer_id: string;
  cohort_id: string;
  group_id: string | null;
  /**
   * Led their group that season. Groups flagged `includes_leads` (战略组) list
   * every lead alongside their own members, which is how one person can be in a
   * working group and the leadership group at once without needing two rows.
   */
  is_lead: boolean;
  created_at: string;
};

/** What `listVolunteers()` returns — the volunteer with its seasons joined in. */
export type VolunteerWithSeasons = Volunteer & {
  seasons: VolunteerSeason[];
};

/**
 * The two columns `volunteers_public` exposes to signed-out visitors. Contact
 * details are absent from the view itself, not filtered out here.
 */
export type PublicVolunteer = {
  id: string;
  full_name: string;
  seasons: string[];
};

/**
 * Which identity the portal is being *viewed as*.
 *
 * This is a presentation lens, not a permission level: RLS and
 * `requireApiRole()` both read the real profile, so previewing as a mentee does
 * not remove an admin's access to anything. See the Persona section of
 * STRUCTURE.md.
 */
export type Persona = "admin" | "mentor" | "mentee" | "volunteer";

/**
 * A volunteer with the linked portal profile already applied — what
 * `volunteers_resolved` returns (migration 0012).
 *
 * `full_name` / `email` / `wechat_number` come from the profile when the
 * volunteer is linked to one, and from the volunteer row otherwise. The
 * `own_*` fields are the volunteer row's own stored values, so the edit dialog
 * can show what it would fall back to if the link were removed.
 */
export type ResolvedVolunteer = {
  id: string;
  profile_id: string | null;
  full_name: string;
  email: string | null;
  wechat_number: string | null;
  avatar_url: string | null;
  notes: string | null;
  is_public: boolean;
  own_full_name: string;
  own_email: string | null;
  own_wechat_number: string | null;
  name_key: string;
  email_key: string | null;
  created_at: string;
  updated_at: string;
};

export type ResolvedVolunteerWithSeasons = ResolvedVolunteer & {
  seasons: VolunteerSeason[];
};
