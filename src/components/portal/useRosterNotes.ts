"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addRosterNoteEntry,
  deleteRosterNoteEntry,
  listMentorRecommendations,
  listRosterNoteEntries,
  listRosterStaffAuthors,
  removeMentorRecommendation,
  setMentorRecommendation,
  updateRosterNoteEntry,
} from "@/lib/portal/store";
import { usePortalSession } from "./PortalSessionProvider";

// Both caches are keyed by the real account and season (see STRUCTURE.md,
// "Internal roster notes"): never merge them into the shared profile cache.

/** The internal note thread of every member of a season (0043). */
export function useRosterNotes(cohortId: string) {
  const { realUser, currentUser } = usePortalSession();
  const client = useQueryClient();
  const queryKey = ["portal", "rosterNoteEntries", realUser?.id, cohortId];
  const query = useQuery({
    queryKey,
    queryFn: () => listRosterNoteEntries(cohortId),
    enabled: Boolean(cohortId && realUser && (currentUser?.is_admin || currentUser?.is_volunteer)),
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["portal", "rosterNoteEntries", realUser?.id] }),
      client.invalidateQueries({ queryKey: ["portal", "rosterStaffAuthors", realUser?.id] }),
    ]);
  const add = useMutation({
    mutationFn: ({ profileId, body }: { profileId: string; body: string }) =>
      addRosterNoteEntry(cohortId, profileId, body),
    onSuccess: refresh,
  });
  const edit = useMutation({
    mutationFn: ({ entryId, body }: { entryId: string; body: string }) =>
      updateRosterNoteEntry(entryId, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (entryId: string) => deleteRosterNoteEntry(entryId),
    onSuccess: refresh,
  });
  return { query, add, edit, remove };
}

/** Mentor recommendations (all seasons) of the mentors in a season (0043). */
export function useMentorRecommendations(cohortId: string) {
  const { realUser, currentUser } = usePortalSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["portal", "mentorRecommendations", realUser?.id, cohortId],
    queryFn: () => listMentorRecommendations(cohortId),
    enabled: Boolean(cohortId && realUser && (currentUser?.is_admin || currentUser?.is_volunteer)),
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["portal", "mentorRecommendations", realUser?.id] }),
      client.invalidateQueries({ queryKey: ["portal", "rosterStaffAuthors", realUser?.id] }),
    ]);
  const set = useMutation({
    mutationFn: ({ mentorId, reason }: { mentorId: string; reason: string | null }) =>
      setMentorRecommendation(cohortId, mentorId, reason),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (mentorId: string) => removeMentorRecommendation(cohortId, mentorId),
    onSuccess: refresh,
  });
  return { query, set, remove };
}

/** Profiles of the people who wrote notes / recommendations in a season (0044). */
export function useRosterStaffAuthors(cohortId: string) {
  const { realUser, currentUser } = usePortalSession();
  return useQuery({
    queryKey: ["portal", "rosterStaffAuthors", realUser?.id, cohortId],
    queryFn: () => listRosterStaffAuthors(cohortId),
    enabled: Boolean(cohortId && realUser && (currentUser?.is_admin || currentUser?.is_volunteer)),
  });
}
