"use client";

import Avatar, { type AvatarProps } from "@mui/material/Avatar";

/**
 * Avatar for other members in lists — directory, favorites, roster,
 * volunteers, board authors, mentor strip. The image is fetched only when it
 * scrolls near the viewport, which keeps Supabase Storage egress down on long
 * lists. The signed-in user's own avatar and single-profile views keep the
 * plain MUI Avatar so they load immediately.
 */
export default function MemberAvatar(props: Omit<AvatarProps, "slotProps">) {
  return (
    <Avatar {...props} slotProps={{ img: { loading: "lazy", decoding: "async" } }} />
  );
}
