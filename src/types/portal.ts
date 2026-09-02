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
