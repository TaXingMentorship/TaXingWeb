"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listMyUnreadComments } from "@/lib/portal/store";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";

export const UNREAD_COMMENTS_KEY = ["portal", "unreadComments"] as const;

/**
 * Comments by others on the signed-in user's own posts that they have not
 * opened yet. Shared by the sidebar badge, the home card and the board so all
 * three agree. Keyed on the real account — like tasks, this is not a persona
 * thing — and re-polled every 5 minutes while the tab is visible so a reply
 * shows up without a reload without continuously hitting the API.
 */
export function useUnreadComments() {
  const { realUser } = usePortalSession();
  const query = useQuery({
    queryKey: [...UNREAD_COMMENTS_KEY, realUser?.id],
    queryFn: listMyUnreadComments,
    enabled: Boolean(realUser),
    // Clients have no SELECT on the comment tables (0009), so Realtime cannot
    // push them. Mutations invalidate this query immediately; this interval is
    // only the background fallback for comments created in another browser.
    refetchInterval: 300_000,
    refetchOnWindowFocus: true,
  });
  const posts = React.useMemo(() => query.data ?? [], [query.data]);
  // Memoised: callers use these as hook dependencies.
  const total = React.useMemo(
    () => posts.reduce((sum, post) => sum + post.unread_count, 0),
    [posts],
  );
  const byPost = React.useMemo(
    () => new Map(posts.map((post) => [post.post_id, post.unread_count])),
    [posts],
  );
  return { ...query, posts, total, byPost };
}
