import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types/portal";

export type CurrentUser = {
  id: string;
  email: string | null;
  profile: Profile | null;
};

/**
 * Returns the signed-in user and their portal profile, or null if not
 * authenticated. Profile may be null if the user has authenticated but not
 * yet completed onboarding.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? null,
    profile: (profile as Profile | null) ?? null,
  };
}

/**
 * Ensures the current user is authenticated and holds one of the allowed
 * roles. Throws when the requirement is not met; callers should map the
 * thrown error to a redirect (pages) or 401/403 (route handlers).
 */
export async function requireRole(
  roles: UserRole | UserRole[],
): Promise<CurrentUser & { profile: Profile }> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getCurrentUser();

  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  if (!user.profile || !allowed.includes(user.profile.role)) {
    throw new Error("FORBIDDEN");
  }

  return { ...user, profile: user.profile };
}
