"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addVolunteerLeadNote,
  deleteVolunteerLeadNote,
  listVolunteerLeadNotes,
  updateVolunteerLeadNote,
} from "@/lib/portal/store";
import { usePortalSession } from "./PortalSessionProvider";

/**
 * Lead-only notes about volunteers (0056). Keyed by the real account — never
 * the persona lens — so one person's notes can never be served from another's
 * cache. `enabled` is the caller's guess (admin or a lead); the database
 * decides, and refuses everyone else.
 */
export function useVolunteerLeadNotes(enabled: boolean) {
  const { realUser } = usePortalSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["portal", "volunteerLeadNotes", realUser?.id],
    queryFn: listVolunteerLeadNotes,
    enabled: Boolean(enabled && realUser),
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["portal", "volunteerLeadNotes", realUser?.id] });
  const add = useMutation({
    mutationFn: ({ volunteerId, body }: { volunteerId: string; body: string }) =>
      addVolunteerLeadNote(volunteerId, body),
    onSuccess: refresh,
  });
  const edit = useMutation({
    mutationFn: ({ noteId, body }: { noteId: string; body: string }) =>
      updateVolunteerLeadNote(noteId, body),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => deleteVolunteerLeadNote(noteId),
    onSuccess: refresh,
  });
  return { query, add, edit, remove };
}
