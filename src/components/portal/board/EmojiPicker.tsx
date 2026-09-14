"use client";

import Box from "@mui/material/Box";
import Popover from "@mui/material/Popover";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";
import { emojiPickerGroups } from "@/data/portalCopy";

/**
 * A small self-contained emoji grid in a popover. Deliberately not a
 * dependency (emoji-mart and friends) — the portal ships MUI only, and a
 * curated list beats a full picker for this use.
 */
export default function EmojiPicker({
  anchorEl,
  onClose,
  onSelect,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      slotProps={{ paper: { sx: { p: 1.5, maxWidth: 300, borderRadius: 2 } } }}
    >
      {emojiPickerGroups.map((group) => (
        <Box key={group.label} sx={{ mb: 1.5, "&:last-of-type": { mb: 0 } }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            {group.label}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: 0.25,
            }}
          >
            {group.emojis.map((emoji) => (
              <ButtonBase
                key={emoji}
                onClick={() => onSelect(emoji)}
                sx={{
                  fontSize: 20,
                  lineHeight: 1,
                  p: 0.5,
                  borderRadius: 1,
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                {emoji}
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ))}
    </Popover>
  );
}
