"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import type { Profile } from "@/types/portal";
import type { MentorGroupColor } from "@/data/mentorGroupColors";
import { portalCopy, profileLabels } from "@/data/portalCopy";

export type DirectoryBadge = {
  label: string;
  color?: string;
  /** Filled badges read as "this is the important one" — used for 负责人. */
  filled?: boolean;
};

/**
 * One member card. `accent` paints a stripe down the left edge and `badges`
 * replace the default role chips, which is how the volunteer tab tells groups
 * and leads apart at a glance. A mentor's Q&A answer group (`group`) takes the
 * same stripe in the group's colour and a chip carrying its name.
 */
export default function DirectoryCard({
  profile,
  onSelect,
  accent,
  badges,
  group,
}: {
  profile: Profile;
  onSelect: (profile: Profile) => void;
  accent?: string;
  badges?: DirectoryBadge[];
  group?: { name: string; color: MentorGroupColor } | null;
}) {
  const stripe = accent ?? group?.color.dot;
  return (
    <Card
      sx={{
        height: "100%",
        borderRadius: 3,
        borderLeft: stripe ? `6px solid ${stripe}` : undefined,
      }}
    >
      <CardActionArea onClick={() => onSelect(profile)} sx={{ height: "100%" }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1.5 }}>
            <Avatar src={profile.avatar_url ?? undefined} sx={{ width: 52, height: 52 }} />
            <Box>
              <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                {profile.full_name}
              </Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {badges
                  ? badges.map((badge) => (
                      <Chip
                        key={badge.label}
                        size="small"
                        label={badge.label}
                        variant={badge.filled ? "filled" : "outlined"}
                        sx={
                          badge.color
                            ? badge.filled
                              ? { bgcolor: badge.color, color: "common.white", fontWeight: 700 }
                              : { borderColor: badge.color, color: badge.color }
                            : undefined
                        }
                      />
                    ))
                  : profileLabels(profile).map((label) => (
                      <Chip key={label} size="small" label={label} color="secondary" variant="outlined" />
                    ))}
              </Stack>
            </Box>
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              minHeight: 40,
            }}
          >
            {profile.bio ?? "暂无简介"}
          </Typography>
          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
            {profile.interests.slice(0, 3).map((i) => (
              <Chip key={i} size="small" label={i} />
            ))}
          </Stack>
          {group && (
            <Tooltip title={portalCopy.board.groupChip(group.name)} placement="bottom-start">
              <Chip
                size="small"
                aria-label={portalCopy.board.groupChip(group.name)}
                label={<GroupLabel name={group.name} />}
                sx={{
                  mt: 1,
                  maxWidth: "100%",
                  bgcolor: group.color.bg,
                  color: group.color.text,
                  border: `1.5px solid ${group.color.dot}`,
                }}
              />
            </Tooltip>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/**
 * A group's name, shortened from the middle: the trailing number is what tells
 * 「产品经理与产品策略类 1」 from 「… 2」, so it never gets cut off, only the
 * words before it do. It is shown as 「组 2」: a bare digit reads as a count.
 */
function GroupLabel({ name }: { name: string }) {
  const match = /^(.*?)(\s*\d+)$/.exec(name);
  const head = match ? match[1] : name;
  const tail = match ? match[2].trim() : "";
  return (
    <Box component="span" sx={{ display: "flex", minWidth: 0 }}>
      <Box component="span" sx={{ flex: "none", pr: 0.5 }}>
        {portalCopy.mentorGroups.columnLabel} ·
      </Box>
      <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {head}
      </Box>
      {tail && (
        <Box component="span" sx={{ flex: "none", pl: 0.5, fontWeight: 700 }}>
          {portalCopy.mentorGroups.numberChip(tail)}
        </Box>
      )}
    </Box>
  );
}
