"use client";

import Avatar from "@mui/material/Avatar";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import type { Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

/**
 * Avatar and name for a non-anonymous post or comment. Both open the author's
 * profile when the profile resolved; 「往期成员」(no profile row) and anonymous
 * rows stay inert. Anonymous rows never reach these — the callers render
 * AnonymousAvatar / anonymousName themselves so a real face is never placed
 * next to a masked author.
 */
export function AuthorAvatar({
  author,
  size,
  onOpen,
}: {
  author: Profile | undefined;
  size: number;
  onOpen: (profile: Profile) => void;
}) {
  const avatar = (
    <Avatar
      src={author?.avatar_url ?? undefined}
      sx={{ width: size, height: size, fontSize: size * 0.45 }}
    />
  );
  if (!author) return avatar;
  return (
    <ButtonBase
      onClick={() => onOpen(author)}
      aria-label={portalCopy.board.viewProfile}
      sx={{ borderRadius: "50%" }}
    >
      {avatar}
    </ButtonBase>
  );
}

export function AuthorName({
  author,
  isAnonymous,
  onOpen,
}: {
  author: Profile | undefined;
  isAnonymous: boolean;
  onOpen: (profile: Profile) => void;
}) {
  const name = isAnonymous
    ? portalCopy.board.anonymousName
    : (author?.full_name ?? portalCopy.board.pastMemberName);
  const clickable = !isAnonymous && Boolean(author);
  return (
    <Typography
      variant="body2"
      fontWeight={700}
      noWrap
      component={clickable ? "button" : "p"}
      onClick={clickable ? () => onOpen(author!) : undefined}
      sx={
        clickable
          ? {
              all: "unset",
              display: "block",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }
          : undefined
      }
    >
      {name}
    </Typography>
  );
}
