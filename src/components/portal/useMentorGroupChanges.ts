"use client";

import { useQuery } from "@tanstack/react-query";
import type { MentorGroupChangeRequest } from "@/types/portal";
import {
  listMyMentorGroupChanges,
  listPendingMentorGroupChanges,
} from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export const MY_GROUP_CHANGES_KEY = ["portal", "myMentorGroupChanges"] as const;
export const PENDING_GROUP_CHANGES_KEY = ["portal", "pendingMentorGroupChanges"] as const;

/**
 * The signed-in mentor's answer-group requests, shared by 我的资料 and the
 * sidebar dot. Keyed on the real account, like the nickname requests.
 */
export function useMyMentorGroupChanges() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: [...MY_GROUP_CHANGES_KEY, realUser?.id],
    queryFn: () => listMyMentorGroupChanges(realUser!.id),
    enabled: Boolean(realUser),
  });
  const requests: MentorGroupChangeRequest[] = query.data ?? [];
  return {
    ...query,
    requests,
    /** Decided requests the requester has not seen yet. */
    unseen: requests.filter(
      (item) => item.status !== "pending" && !item.requester_seen_at,
    ),
  };
}

/** Admin only: requests waiting for a decision. */
export function usePendingMentorGroupChanges() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: PENDING_GROUP_CHANGES_KEY,
    queryFn: listPendingMentorGroupChanges,
    enabled: Boolean(realUser?.is_admin),
    // The sidebar badge is the admin's only prompt, so keep it fresh.
    refetchInterval: 60_000,
  });
  return { ...query, requests: query.data ?? [] };
}
