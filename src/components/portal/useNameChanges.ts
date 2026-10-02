"use client";

import { useQuery } from "@tanstack/react-query";
import type { NameChangeRequest } from "@/types/portal";
import {
  listMyNameChanges,
  listPendingNameChanges,
} from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export const MY_NAME_CHANGES_KEY = ["portal", "myNameChanges"] as const;
export const PENDING_NAME_CHANGES_KEY = ["portal", "pendingNameChanges"] as const;

/**
 * The signed-in user's nickname requests, shared by 我的资料 and the sidebar
 * dot. Keyed on the real account: a persona preview doesn't change whose name
 * is being edited.
 */
export function useMyNameChanges() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: [...MY_NAME_CHANGES_KEY, realUser?.id],
    queryFn: () => listMyNameChanges(realUser!.id),
    enabled: Boolean(realUser),
  });
  const requests: NameChangeRequest[] = query.data ?? [];
  return {
    ...query,
    requests,
    pending: requests.find((item) => item.status === "pending") ?? null,
    /** The latest decided request, if the requester hasn't seen it yet. */
    unseen: requests.filter(
      (item) => item.status !== "pending" && !item.requester_seen_at,
    ),
    latestDecided:
      requests.find((item) => item.status !== "pending") ?? null,
  };
}

/** Admin only: requests waiting for a decision. */
export function usePendingNameChanges() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: PENDING_NAME_CHANGES_KEY,
    queryFn: listPendingNameChanges,
    enabled: Boolean(realUser?.is_admin),
    // The sidebar badge is the admin's only prompt; without a poll it would
    // stay at its page-load value until the tab is refocused.
    refetchInterval: 60_000,
  });
  return { ...query, requests: query.data ?? [] };
}
