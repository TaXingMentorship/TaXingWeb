// Pure pieces of the member directory's filtering, so they can be tested
// without a page. No runtime imports.
import type { Profile } from "../../types/portal";

/**
 * The answer-group filter on the mentor tab: "all", "none" (a mentor with no
 * group this season) or a group id.
 */
export function matchesGroupFilter(
  filter: string,
  groupId: string | null | undefined,
): boolean {
  if (filter === "all") return true;
  if (filter === "none") return !groupId;
  return groupId === filter;
}

/**
 * The directory's search box: a substring of name, bio, background, an
 * interest, or (for a mentor) the answer group's name, so typing 「产品 组2」's
 * words finds that group's mentors. Each field is tested on its own, as the
 * search always was; a query never spans two fields.
 */
export function matchesSearch(
  query: string,
  profile: Pick<Profile, "full_name" | "bio" | "background" | "interests">,
  groupName?: string | null,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [profile.full_name, profile.bio, profile.background, ...profile.interests, groupName]
    .filter((field): field is string => Boolean(field))
    .some((field) => field.toLowerCase().includes(q));
}
