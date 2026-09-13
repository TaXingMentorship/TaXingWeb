"use client";

import * as React from "react";
import Avatar from "@mui/material/Avatar";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { portalCopy } from "@/data/portalCopy";

/**
 * The stand-in avatar for an anonymous post or comment.
 *
 * It must never be derived from the author. Migration 0009 masks `author_id`
 * for everyone except admins and the author themselves, so those two *can* see
 * who wrote an anonymous post — and the card previously passed
 * `author.avatar_url` straight into `src` regardless of `is_anonymous`, which
 * put the real face above the words 「匿名成员」.
 *
 * The colour comes from the **post's own id**, not the author's. A per-author
 * colour would be a deanonymisation vector: two anonymous posts sharing a
 * colour would tell everyone they share an author. A per-post id is random and
 * links to nothing, so it buys visual variety for free.
 */
const PALETTE = [
  "#8E9AAF",
  "#A8998A",
  "#9AA79A",
  "#B0929E",
  "#8FA3AD",
  "#A79A8F",
] as const;

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export default function AnonymousAvatar({
  /** The post's or comment's id — never the author's. */
  seed,
  size = 32,
}: {
  seed: string;
  size?: number;
}) {
  return (
    <Avatar
      sx={{ width: size, height: size, bgcolor: colorFor(seed) }}
      aria-label={portalCopy.board.anonymousName}
    >
      <PersonOutlineIcon sx={{ fontSize: size * 0.6 }} />
    </Avatar>
  );
}
