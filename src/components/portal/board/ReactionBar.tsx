"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import type { BulletinReaction } from "@/types/portal";
import { reactionEmojis } from "@/data/portalCopy";

/**
 * Emoji reactions for one post. Only emoji that someone has already used are
 * shown as counted chips; the rest sit behind the trailing "+" chip so the
 * card stays quiet.
 */
export default function ReactionBar({
  reactions,
  currentUserId,
  disabled,
  onToggle,
}: {
  reactions: BulletinReaction[];
  currentUserId: string | null;
  disabled: boolean;
  onToggle: (emoji: string, active: boolean) => void;
}) {
  const [showAll, setShowAll] = React.useState(false);

  const counts = React.useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const reaction of reactions) {
      const entry = map.get(reaction.emoji) ?? { count: 0, mine: false };
      entry.count += 1;
      if (reaction.user_id === currentUserId) entry.mine = true;
      map.set(reaction.emoji, entry);
    }
    return map;
  }, [reactions, currentUserId]);

  const visible = showAll
    ? reactionEmojis
    : reactionEmojis.filter((emoji) => counts.has(emoji));

  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
      {visible.map((emoji) => {
        const entry = counts.get(emoji);
        return (
          <Chip
            key={emoji}
            size="small"
            variant={entry?.mine ? "filled" : "outlined"}
            color={entry?.mine ? "secondary" : "default"}
            label={`${emoji}${entry ? ` ${entry.count}` : ""}`}
            onClick={
              disabled ? undefined : () => onToggle(emoji, entry?.mine ?? false)
            }
            sx={{ bgcolor: entry?.mine ? undefined : "background.paper" }}
          />
        );
      })}
      {!disabled && !showAll && (
        <Chip
          size="small"
          variant="outlined"
          label="＋"
          onClick={() => setShowAll(true)}
          sx={{ bgcolor: "background.paper" }}
        />
      )}
    </Box>
  );
}
