"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import ButtonBase from "@mui/material/ButtonBase";
import type { BulletinReaction } from "@/types/portal";
import { reactionEmojis } from "@/data/portalCopy";

/**
 * Emoji reactions for one post. Only emoji that someone has already used are
 * shown as counted chips; the rest sit behind the trailing "+" chip, which
 * opens a popover so the card never reflows. Picking one closes it — the
 * old inline expansion had no way back and left the full list stacked in
 * the card for good.
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
  const [pickerAnchor, setPickerAnchor] = React.useState<HTMLElement | null>(null);

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

  const used = reactionEmojis.filter((emoji) => counts.has(emoji));

  return (
    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
      {used.map((emoji) => {
        const entry = counts.get(emoji)!;
        return (
          <Chip
            key={emoji}
            size="small"
            variant={entry.mine ? "filled" : "outlined"}
            color={entry.mine ? "secondary" : "default"}
            label={`${emoji} ${entry.count}`}
            onClick={disabled ? undefined : () => onToggle(emoji, entry.mine)}
            sx={{ bgcolor: entry.mine ? undefined : "background.paper" }}
          />
        );
      })}
      {!disabled && (
        <>
          <Chip
            size="small"
            variant="outlined"
            label="＋"
            onClick={(e) => setPickerAnchor(e.currentTarget)}
            sx={{ bgcolor: "background.paper" }}
          />
          <Popover
            open={Boolean(pickerAnchor)}
            anchorEl={pickerAnchor}
            onClose={() => setPickerAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            slotProps={{ paper: { sx: { p: 1, borderRadius: 2 } } }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 0.25,
              }}
            >
              {reactionEmojis.map((emoji) => {
                const entry = counts.get(emoji);
                return (
                  <ButtonBase
                    key={emoji}
                    onClick={() => {
                      onToggle(emoji, entry?.mine ?? false);
                      setPickerAnchor(null);
                    }}
                    sx={{
                      fontSize: 20,
                      lineHeight: 1,
                      p: 0.5,
                      borderRadius: 1,
                      bgcolor: entry?.mine ? "action.selected" : undefined,
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    {emoji}
                  </ButtonBase>
                );
              })}
            </Box>
          </Popover>
        </>
      )}
    </Box>
  );
}
