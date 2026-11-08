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
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import { isRecorded, sessionMinutesFor } from "@/data/activityTimeline";

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

type SessionStatus = "upcoming" | "live" | "past";

/**
 * Sessions have no end time: one counts as 进行中 for its row's session length
 * after it starts (Office Hour one hour, others DEFAULT_SESSION_MINUTES).
 * A session with a recording link is over by definition, so it is 已结束
 * as soon as the link is saved, whatever the clock says.
 */
export function sessionStatus(
  item: Pick<ActivityItem, "starts_at" | "parent_key" | "recording_url">,
  now: number,
): SessionStatus {
  if (item.recording_url) return "past";
  const start = new Date(item.starts_at!).getTime();
  if (now < start) return "upcoming";
  if (now < start + sessionMinutesFor(item.parent_key) * 60 * 1000) return "live";
  return "past";
}

// Times are shown in the viewer's own zone, which is printed once on the page
// (viewerZoneName) rather than on every session.
const dayFormat = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
});
const clockFormat = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `19:00`, in the viewer's zone. */
export function formatClock(startsAt: string): string {
  return clockFormat.format(new Date(startsAt));
}

/** A moment's `YYYY-MM-DD` in the viewer's zone — the day a session is listed under. */
export function viewerDayKey(moment: Date): string {
  return dayKeyFormat.format(moment);
}

/** The viewer's zone as the browser abbreviates it, e.g. `GMT+8`. */
export function viewerZoneName(): string {
  return (
    new Intl.DateTimeFormat("zh-CN", { timeZoneName: "short" })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName")?.value ?? ""
  );
}

/** `11月9日周一 19:00`, in the viewer's zone. */
export function formatSessionTime(startsAt: string): string {
  const d = new Date(startsAt);
  return `${dayFormat.format(d)} ${clockFormat.format(d)}`;
}

const linkButtonProps = {
  component: "a",
  target: "_blank",
  rel: "noopener noreferrer",
  size: "small",
  variant: "outlined",
  color: "secondary",
} as const;

/** Above this many upcoming sessions a row shows the first few and a 展开 button. */
const VISIBLE_UPCOMING = 5;
/** …unless that would hide only one or two. */
const COLLAPSE_SLACK = 2;

const FEISHU_DOMAINS = ["feishu.cn", "larksuite.com", "larkoffice.com"];

/** Whether `url`'s host is one of `domains` or a subdomain of one. False for a bad URL. */
function hostIn(url: string, domains: string[]): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Which app a meeting link opens, so the button can say 加入飞书会议 rather
 * than a bare 会议链接 — people need to know whether to install Feishu first.
 * Null for hosts we do not recognise.
 */
export function meetingProvider(url: string): string | null {
  const providers = portalCopy.activities.subItems.providers;
  if (hostIn(url, FEISHU_DOMAINS)) return providers.feishu;
  if (hostIn(url, ["meeting.tencent.com", "voovmeeting.com"])) return providers.tencent;
  if (hostIn(url, ["zoom.us", "zoom.com"])) return providers.zoom;
  return null;
}

/** Which app a document link opens in (飞书 / 腾讯文档), or null. */
export function docApp(url: string): string | null {
  const apps = portalCopy.activities.subItems.docApps;
  if (hostIn(url, FEISHU_DOMAINS)) return apps.feishu;
  if (hostIn(url, ["docs.qq.com"])) return apps.tencentDocs;
  return null;
}

/** The row's 总表: its first link sub-item, which sessions without a link point to. */
export function rowSheetUrl(items: ActivityItem[]): string | null {
  return items.find((i) => i.kind === "link")?.url ?? null;
}

/**
 * A session's meeting / recording links by status: 加入飞书会议 (or 会议链接
 * for an unknown host) before it ends, 会议链接待更新 when none is set yet,
 * then 观看录屏 or 录屏整理中 afterwards.
 */
export function SessionLinks({
  item,
  past,
  sheetUrl = null,
}: {
  item: ActivityItem;
  past: boolean;
  /** The row's 总表 (rowSheetUrl): shown instead of 会议链接待更新. */
  sheetUrl?: string | null;
}) {
  const copy = portalCopy.activities.subItems;
  const provider = item.meeting_url ? meetingProvider(item.meeting_url) : null;
  return (
    <>
      {!past && item.meeting_url && (
        <Button {...linkButtonProps} href={item.meeting_url} startIcon={<VideocamOutlinedIcon />}>
          {provider ? copy.joinMeeting(provider) : copy.meeting}
        </Button>
      )}
      {!past && !item.meeting_url && sheetUrl && (
        <Button {...linkButtonProps} href={sheetUrl} startIcon={<TableChartOutlinedIcon />}>
          {copy.sheet(docApp(sheetUrl))}
        </Button>
      )}
      {!past && !item.meeting_url && !sheetUrl && (
        <Typography variant="body2" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
          {copy.meetingPending}
        </Typography>
      )}
      {item.recording_url && (
        <Button {...linkButtonProps} href={item.recording_url} startIcon={<PlayCircleOutlineIcon />}>
          {copy.recording}
        </Button>
      )}
      {past && !item.recording_url && isRecorded(item.parent_key) && (
        <Stack direction="row" spacing={0.5} alignItems="center" color="warning.dark">
          <ScheduleIcon fontSize="small" />
          <Typography variant="body2" fontWeight={600}>{copy.recordingPending}</Typography>
        </Stack>
      )}
    </>
  );
}

/**
 * One session as a single line: time, title, its links. The summary opens
 * under it on demand, so a row of thirty sessions stays scannable.
 */
function SessionRow({
  item,
  now,
  editButton,
  sheetUrl,
}: {
  item: ActivityItem;
  now: number;
  sheetUrl: string | null;
  editButton: React.ReactNode;
}) {
  const copy = portalCopy.activities;
  const [open, setOpen] = React.useState(false);
  const status = sessionStatus(item, now);
  const past = status === "past";
  const summaryId = `activity-summary-${item.id}`;

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Stack direction="row" spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
        <Typography
          variant="body2"
          fontWeight={700}
          color={past ? "text.secondary" : "primary.dark"}
          sx={{ minWidth: 42, fontVariantNumeric: "tabular-nums", pt: { xs: 0.25, sm: 0 } }}
        >
          {formatClock(item.starts_at!)}
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 0.75, sm: 1 }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ flex: 1, minWidth: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            {status === "live" && (
              <Chip size="small" color="primary" label={copy.subItems.status.live} />
            )}
            <Typography
              variant="body2"
              fontWeight={600}
              color={past ? "text.secondary" : "text.primary"}
              sx={{ minWidth: 0 }}
            >
              {item.title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <SessionLinks item={item} past={past} sheetUrl={sheetUrl} />
            {item.summary && (
              <Tooltip title={copy.browse.details}>
                <IconButton
                  size="small"
                  aria-label={copy.browse.details}
                  aria-expanded={open}
                  aria-controls={summaryId}
                  onClick={() => setOpen((v) => !v)}
                >
                  <ExpandMoreIcon
                    fontSize="small"
                    sx={{ transition: "transform 150ms", transform: open ? "rotate(180deg)" : "none" }}
                  />
                </IconButton>
              </Tooltip>
            )}
            {editButton}
          </Stack>
        </Stack>
      </Stack>
      {item.summary && (
        <Collapse in={open} unmountOnExit>
          <Typography
            id={summaryId}
            variant="body2"
            color="text.secondary"
            sx={{ whiteSpace: "pre-line", mt: 0.75, pl: { xs: 0, sm: "54px" } }}
          >
            <LinkifiedText text={item.summary} />
          </Typography>
        </Collapse>
      )}
    </Box>
  );
}

/** Sessions grouped under a heading per day, in the viewer's zone. */
function SessionsByDay({
  sessions,
  now,
  editButton,
  sheetUrl,
}: {
  sessions: ActivityItem[];
  now: number;
  sheetUrl: string | null;
  editButton: (item: ActivityItem) => React.ReactNode;
}) {
  const days: { key: string; label: string; items: ActivityItem[] }[] = [];
  for (const item of sessions) {
    const d = new Date(item.starts_at!);
    const key = dayKeyFormat.format(d);
    const last = days[days.length - 1];
    if (last?.key === key) last.items.push(item);
    else days.push({ key, label: dayFormat.format(d), items: [item] });
  }
  return (
    <Stack spacing={1}>
      {days.map((day) => (
        <Box key={day.key}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ pl: 0.5 }}>
            {day.label}
          </Typography>
          <Box
            sx={{
              mt: 0.5,
              borderRadius: 2,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            {day.items.map((item, i) => (
              <React.Fragment key={item.id}>
                {i > 0 && <Divider />}
                <SessionRow item={item} now={now} editButton={editButton(item)} sheetUrl={sheetUrl} />
              </React.Fragment>
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * The 子活动 nested inside one timeline row: links first, then sessions by
 * day. Past sessions fold behind 已结束 N 场, and a long run of upcoming ones
 * shows the first few behind 展开其余. Renders nothing when there are none.
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
  const copy = portalCopy.activities;
  const [showPast, setShowPast] = React.useState(false);
  const [showAll, setShowAll] = React.useState(false);

  if (items.length === 0) return null;

  const editButton = (item: ActivityItem) =>
    canEdit && (
      <Tooltip title={copy.subItems.edit}>
        <IconButton size="small" aria-label={copy.subItems.edit} onClick={() => onEdit(item)}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    );

  const links = items.filter((i) => i.kind === "link");
  const sheetUrl = rowSheetUrl(items);
  const sessions = items.filter((i) => i.kind === "session");
  const past = sessions.filter((i) => sessionStatus(i, now) === "past");
  const active = sessions.filter((i) => sessionStatus(i, now) !== "past");
  const collapsible = active.length > VISIBLE_UPCOMING + COLLAPSE_SLACK;
  const visibleActive = collapsible && !showAll ? active.slice(0, VISIBLE_UPCOMING) : active;

  return (
    <Stack spacing={1} sx={{ mt: 1.5, pl: { xs: 0, sm: 1.5 }, borderLeft: { sm: "2px solid" }, borderColor: { sm: "divider" } }}>
      {links.map((item) => (
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
              {copy.subItems.openIn(docApp(item.url!))}
            </Button>
            {editButton(item)}
          </Stack>
        </Stack>
      ))}

      {past.length > 0 && (
        <Box>
          <Button
            fullWidth
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            startIcon={<TaskAltIcon color="success" />}
            endIcon={
              <ExpandMoreIcon sx={{ transition: "transform 150ms", transform: showPast ? "rotate(180deg)" : "none" }} />
            }
            sx={{
              justifyContent: "flex-start",
              gap: 0.5,
              px: 1.5,
              py: 1,
              borderRadius: 3,
              fontWeight: 700,
              color: "text.primary",
              bgcolor: "action.selected",
              border: "1px solid",
              borderColor: "divider",
              "& .MuiButton-endIcon": { ml: "auto" },
              "&:hover": { bgcolor: "action.focus" },
            }}
          >
            {showPast ? copy.browse.hidePast : copy.browse.showPast(past.length)}
          </Button>
          <Collapse in={showPast} unmountOnExit>
            <Box sx={{ mt: 0.5 }}>
              <SessionsByDay sessions={past} now={now} editButton={editButton} sheetUrl={sheetUrl} />
            </Box>
          </Collapse>
        </Box>
      )}

      {visibleActive.length > 0 && (
        <SessionsByDay sessions={visibleActive} now={now} editButton={editButton} sheetUrl={sheetUrl} />
      )}

      {collapsible && (
        <Box>
          <Button
            size="small"
            color="secondary"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            endIcon={
              <ExpandMoreIcon sx={{ transition: "transform 150ms", transform: showAll ? "rotate(180deg)" : "none" }} />
            }
          >
            {showAll ? copy.browse.showLess : copy.browse.showMore(active.length - VISIBLE_UPCOMING)}
          </Button>
        </Box>
      )}
    </Stack>
  );
}
