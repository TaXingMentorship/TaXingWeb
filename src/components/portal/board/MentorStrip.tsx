"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { Profile } from "@/types/portal";
import { portalCopy } from "@/data/portalCopy";

/**
 * Every mentor of a group as avatar + nickname, laid out flat — no overflow
 * counter, so a mentee sees the whole group at a glance. Hovering shows a short
 * card; clicking (the only gesture on touch) opens the full profile.
 */
export default function MentorStrip({
  mentors,
  onOpenProfile,
}: {
  mentors: Profile[];
  onOpenProfile: (profile: Profile) => void;
}) {
  if (mentors.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {portalCopy.board.groupNoMentors}
      </Typography>
    );
  }

  return (
    <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap>
      {mentors.map((mentor) => (
        <Tooltip
          key={mentor.id}
          arrow
          placement="bottom-start"
          slotProps={{
            tooltip: {
              sx: {
                bgcolor: "background.paper",
                color: "text.primary",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: 3,
                p: 1.5,
                maxWidth: 280,
              },
            },
            arrow: { sx: { color: "background.paper", "&::before": { border: "1px solid", borderColor: "divider" } } },
          }}
          title={<MentorCard mentor={mentor} />}
        >
          <Chip
            clickable
            variant="outlined"
            onClick={() => onOpenProfile(mentor)}
            avatar={<Avatar src={mentor.avatar_url ?? undefined} />}
            label={mentor.full_name ?? "—"}
          />
        </Tooltip>
      ))}
    </Stack>
  );
}

function MentorCard({ mentor }: { mentor: Profile }) {
  const lines = [mentor.field, mentor.background].filter(Boolean) as string[];
  return (
    <Box>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.75 }}>
        <Avatar src={mentor.avatar_url ?? undefined} sx={{ width: 36, height: 36 }} />
        <Typography variant="subtitle2" fontWeight={700}>
          {mentor.full_name}
        </Typography>
      </Stack>
      {lines.map((line) => (
        <Typography
          key={line}
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {line}
        </Typography>
      ))}
      {mentor.topics && (
        <Typography variant="caption" display="block" sx={{ mt: 0.5 }} noWrap>
          {mentor.topics}
        </Typography>
      )}
      <Typography variant="caption" color="secondary.main" display="block" sx={{ mt: 0.5 }}>
        {portalCopy.board.mentorCardMore}
      </Typography>
    </Box>
  );
}
