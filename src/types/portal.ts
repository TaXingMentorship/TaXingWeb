export type ParticipantRole = "mentor" | "mentee";
export type UserRole = "admin" | ParticipantRole;

export type BulletinCategory = "wish" | "thanks" | "growth" | "other";

export type SessionType = "mentorship" | "gratitude";

export type BulletinBoard = {
  id: string;
  cohort_id: string;
  name: string;
  description: string | null;
  is_open: boolean;
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
  author_id: string;
  category: BulletinCategory;
  body: string;
  hidden: boolean;
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
