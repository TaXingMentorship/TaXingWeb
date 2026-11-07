"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listRosterNotes, setRosterNote } from "@/lib/portal/store";
import { usePortalSession } from "./PortalSessionProvider";

export function useRosterNotes(cohortId: string) {
  const { realUser, currentUser } = usePortalSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["portal", "rosterNotes", realUser?.id, cohortId],
    queryFn: () => listRosterNotes(cohortId),
    enabled: Boolean(cohortId && realUser && (currentUser?.is_admin || currentUser?.is_volunteer)),
  });
  const save = useMutation({
    mutationFn: ({ profileId, notes }: { profileId: string; notes: string | null }) =>
      setRosterNote(cohortId, profileId, notes),
    onSuccess: () => client.invalidateQueries({ queryKey: ["portal", "rosterNotes", realUser?.id] }),
  });
  return { query, save };
}
