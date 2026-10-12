"use client";

import * as React from "react";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { UnreadPostSummary } from "@/types/portal";
import { unreadChipSx } from "./unreadStyle";
import { portalCopy } from "@/data/portalCopy";

const PREVIEW_LIMIT = 3;

/**
 * 「有新评论」 strip at the top of the board: every post the viewer follows that
 * has comments they have not opened, across boards and seasons. Picking one
 * jumps to its group, scrolls to the card and opens its comments, so nobody has
 * to hunt for the post behind a badge.
 */
export default function UnreadBar({
  items,
  currentBoardId,
  groupNameOf,
  onOpen,
}: {
  items: UnreadPostSummary[];
  currentBoardId: string | null;
  groupNameOf: (groupId: string | null) => string | undefined;
  onOpen: (item: UnreadPostSummary) => void;
}) {
  const copy = portalCopy.boardReplies;
  const [expanded, setExpanded] = React.useState(false);
  if (items.length === 0) return null;

  const total = items.reduce((sum, item) => sum + item.unread_count, 0);
  const shown = expanded ? items : items.slice(0, PREVIEW_LIMIT);

  return (
    <Alert severity="info" sx={{ mb: 2 }}>
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
        {copy.title(total)}
      </Typography>
      <Stack
        spacing={0.5}
        // Expanded, a long list scrolls inside the bar (about eight rows)
        // instead of pushing the board off the screen.
        sx={expanded ? { maxHeight: 240, overflowY: "auto", pr: 0.5 } : undefined}
      >
        {shown.map((item) => {
          const group = item.board_id === currentBoardId ? groupNameOf(item.group_id) : undefined;
          return (
            <Stack key={item.post_id} direction="row" spacing={1} alignItems="center">
              {group && <Chip size="small" label={group} />}
              <Link
                component="button"
                type="button"
                variant="body2"
                underline="hover"
                color="inherit"
                onClick={() => onOpen(item)}
                sx={{ textAlign: "left", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {item.title || item.body}
              </Link>
              <Chip size="small" label={copy.chip(item.unread_count)} sx={{ flexShrink: 0, ...unreadChipSx }} />
            </Stack>
          );
        })}
      </Stack>
      {items.length > PREVIEW_LIMIT && (
        <Link
          component="button"
          type="button"
          variant="caption"
          underline="hover"
          color="text.secondary"
          onClick={() => setExpanded((open) => !open)}
          sx={{ mt: 0.5 }}
        >
          {expanded ? copy.collapse : copy.more(items.length - PREVIEW_LIMIT)}
        </Link>
      )}
    </Alert>
  );
}
