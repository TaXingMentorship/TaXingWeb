"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import type { ActivityItem } from "@/types/portal";
import { listActivityItems } from "@/lib/portal/store";
import { useIsSeasonStaff } from "@/components/portal/useSeasonStaff";
import LinkifiedText from "@/components/portal/board/LinkifiedText";
import { portalCopy } from "@/data/portalCopy";

export const activityItemsKey = (cohortId: string | undefined) =>
  ["portal", "activityItems", cohortId] as const;

/** How often the status chips (即将开始 / 进行中 / 已结束) are re-evaluated. */
const CLOCK_TICK_MS = 60 * 1000;

/**
 * One season's 子活动 (0038), whether the viewer may add or edit them (the
 * season-staff rule, shared with board notices), and a clock that ticks every
 * minute so a page left open moves a session from 即将开始 to 已结束.
 */
export function useActivityItems(cohortId: string | undefined) {
  const { data: items } = useQuery({
    queryKey: activityItemsKey(cohortId),
    queryFn: () => listActivityItems(cohortId!),
    enabled: Boolean(cohortId),
  });
  const canEdit = useIsSeasonStaff(cohortId);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  return { items: items ?? [], canEdit, now };
}

/** A session counts as 进行中 for this long after it starts — there is no end time. */
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

type SessionStatus = "upcoming" | "live" | "past";

function sessionStatus(startsAt: string, now: number): SessionStatus {
  const start = new Date(startsAt).getTime();
  if (now < start) return "upcoming";
  if (now < start + LIVE_WINDOW_MS) return "live";
  return "past";
}

const timeFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZoneName: "short",
});

const linkButtonProps = {
  component: "a",
  target: "_blank",
  rel: "noopener noreferrer",
  size: "small",
  variant: "outlined",
  color: "secondary",
} as const;

/**
 * The 子活动 nested inside one timeline row: links first, then sessions in
 * date order (the list query already sorts that way). Renders nothing when
 * there are none.
 */
export default function ActivitySubItems({
  items,
  canEdit,
  now,
  onEdit,
}: {
  items: ActivityItem[];
  canEdit: boolean;
  /** From useActivityItems, so every row shares one clock. */
  now: number;
  onEdit: (item: ActivityItem) => void;
}) {
  const copy = portalCopy.activities.subItems;

  if (items.length === 0) return null;

  return (
    <Stack spacing={1} sx={{ mt: 1.5, pl: { xs: 0, sm: 1.5 }, borderLeft: { sm: "2px solid" }, borderColor: { sm: "divider" } }}>
      {items.map((item) => {
        const editButton = canEdit && (
          <Tooltip title={copy.edit}>
            <IconButton size="small" aria-label={copy.edit} onClick={() => onEdit(item)}>
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );

        if (item.kind === "link") {
          return (
            <Stack
              key={item.id}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1}
              sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <TableChartOutlinedIcon color="secondary" fontSize="small" sx={{ mt: 0.25 }} />
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {item.title}
                  </Typography>
                  {item.summary && (
                    <Typography variant="body2" color="text.secondary">
                      {item.summary}
                    </Typography>
                  )}
                </Box>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button {...linkButtonProps} href={item.url!} endIcon={<OpenInNewIcon />}>
                  {copy.open}
                </Button>
                {editButton}
              </Stack>
            </Stack>
          );
        }

        const status = sessionStatus(item.starts_at!, now);
        const past = status === "past";
        return (
          <Box
            key={item.id}
            sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" label={copy.status[status]} color={past ? "default" : "primary"} />
              <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
                {timeFormat.format(new Date(item.starts_at!))}
              </Typography>
              {editButton}
            </Stack>
            <Typography variant="body2" fontWeight={700} sx={{ mt: 0.75 }}>
              {item.title}
            </Typography>
            {item.summary && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                <LinkifiedText text={item.summary} />
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              {!past && item.meeting_url && (
                <Button {...linkButtonProps} href={item.meeting_url} startIcon={<VideocamOutlinedIcon />}>
                  {copy.meeting}
                </Button>
              )}
              {item.recording_url && (
                <Button {...linkButtonProps} href={item.recording_url} startIcon={<PlayCircleOutlineIcon />}>
                  {copy.recording}
                </Button>
              )}
              {past && !item.recording_url && (
                <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                  <ScheduleIcon fontSize="small" />
                  <Typography variant="body2">{copy.recordingPending}</Typography>
                </Stack>
              )}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
}
