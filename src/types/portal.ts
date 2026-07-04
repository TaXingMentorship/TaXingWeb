export type UserRole = "admin" | "mentor" | "mentee";

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
  role: UserRole;
  cohort_ids: string[];
  full_name: string | null;
  email: string | null;
  wechat_number: string | null;
  bio: string | null;
  background: string | null;
  interests: string[];
  goals: string | null;
  linkedin: string | null;
  avatar_url: string | null;
  visible: boolean;
  created_at: string;
  updated_at: string;
};

export type RosterInvite = {
  id: string;
  cohort_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
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
  created_at: string;
};
