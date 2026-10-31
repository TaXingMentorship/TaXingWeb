"use client";

import { useQuery } from "@tanstack/react-query";
import { isSeasonVolunteer } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

/**
 * Whether the viewer may edit a season's staff-written content — board notices
 * (0032) and activity sub-items (0038): admins, and the volunteers on that
 * season's roster. Mirrors `is_admin() or is_season_volunteer(cohort_id)`.
 *
 * The roster check is asked only through the volunteer persona, which is a
 * display lens; RLS decides the write either way. `enabled` lets a page skip
 * the query when nothing on screen needs it.
 */
export function useIsSeasonStaff(cohortId: string | undefined, enabled = true): boolean {
  const { currentUser, realUser } = usePortalSession();
  const isVolunteer = Boolean(currentUser?.is_volunteer);
  const { data: seasonVolunteer } = useQuery({
    queryKey: ["portal", "seasonVolunteer", realUser?.id, cohortId],
    queryFn: () => isSeasonVolunteer(cohortId!),
    enabled: Boolean(cohortId) && enabled && isVolunteer,
  });
  if (!cohortId) return false;
  return Boolean(currentUser?.is_admin) || (isVolunteer && Boolean(seasonVolunteer));
}
