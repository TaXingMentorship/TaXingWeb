"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import EditCalendarOutlinedIcon from "@mui/icons-material/EditCalendarOutlined";
import UpcomingOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import DescriptionIcon from "@mui/icons-material/Description";
import TimelineIcon from "@mui/icons-material/Timeline";
import ExploreIcon from "@mui/icons-material/Explore";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { usePortalSession } from "@/components/portal/PortalSessionProvider";
import ActivitySubItems, {
  activityItemsKey,
  formatSessionTime,
  rowSheetUrl,
  SessionLinks,
  sessionStatus,
  useActivityItems,
  viewerZoneName,
} from "@/components/portal/ActivitySubItems";
import ActivityItemDialog from "@/components/portal/ActivityItemDialog";
import ActivitySessionCalendar from "@/components/portal/ActivitySessionCalendar";
import TimelineDatesDialog from "@/components/portal/TimelineDatesDialog";
import {
  timelineDatesKey,
  useTimelineRows,
} from "@/components/portal/useTimelineRows";
import { listCohorts } from "@/lib/portal/store";
import { portalCopy } from "@/data/portalCopy";
import type { ActivityItem } from "@/types/portal";
import {
  formatFullDay,
  formatRange,
  programDay,
  rowPhase,
  TIMELINE_COHORT_ID,
  timelineSpan,
  type TimelineRow,
} from "@/data/activityTimeline";

/** How many sessions the 接下来 card lists. */
const UP_NEXT_COUNT = 4;

/**
 * The next few sessions across every row — what most visitors open the page
 * for — with their meeting links, above the full timeline.
 */
function UpNext({
  items,
  rows,
  now,
}: {
  items: ActivityItem[];
  rows: TimelineRow[];
  now: number;
}) {
  const copy = portalCopy.activities.upNext;
  const upcoming = items.filter(
    (i) => i.kind === "session" && sessionStatus(i, now) !== "past",
  );
  if (upcoming.length === 0) return null;
  const rowTitle = new Map(rows.map((r) => [r.key, r.title]));
  const sheetByRow = new Map(
    rows.map((r) => [r.key, rowSheetUrl(items.filter((i) => i.parent_key === r.key))]),
  );
  const shown = upcoming.slice(0, UP_NEXT_COUNT);
  const statusCopy = portalCopy.activities.subItems.status;

  return (
    <Paper
      sx={{
        p: { xs: 3, lg: 2.5 },
        borderRadius: 3,
        border: "1px solid",
        borderColor: "#fbd9a3",
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <UpcomingOutlinedIcon color="secondary" />
        <Typography variant="h6" fontWeight={700}>
          {copy.title}
        </Typography>
      </Stack>
      <Divider sx={{ my: 2 }} />
      <Stack spacing={1.25}>
        {shown.map((item) => {
          const live = sessionStatus(item, now) === "live";
          return (
            <Stack
              key={item.id}
              // A row on tablets; stacked on phones and in the narrow
              // right-hand column on wide screens.
              direction={{ xs: "column", sm: "row", lg: "column" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center", lg: "flex-start" }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color="primary.dark"
                  >
                    {formatSessionTime(item.starts_at!)}
                  </Typography>
                  {live && (
                    <Chip
                      size="small"
                      color="primary"
                      label={statusCopy.live}
                    />
                  )}
                </Stack>
                <Typography variant="body2" fontWeight={600}>
                  {item.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {rowTitle.get(item.parent_key)}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5}>
                <SessionLinks
                  item={item}
                  past={false}
                  sheetUrl={sheetByRow.get(item.parent_key) ?? null}
                />
              </Stack>
            </Stack>
          );
        })}
        {upcoming.length > shown.length && (
          <Typography variant="body2" color="text.secondary">
            {copy.more(upcoming.length - shown.length)}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

type Section = {
  key: "files" | "main" | "side";
  label: string;
  icon: React.ReactNode;
};

const sections: Section[] = [
  {
    key: "files",
    label: portalCopy.activities.sections.files,
    icon: <DescriptionIcon color="secondary" />,
  },
  {
    key: "main",
    label: portalCopy.activities.sections.main,
    icon: <TimelineIcon color="secondary" />,
  },
  {
    key: "side",
    label: portalCopy.activities.sections.side,
    icon: <ExploreIcon color="secondary" />,
  },
];

const importantFiles = [
  {
    title: "2026 秋季她行活动 Mentor 守则",
    href: "/documents/2026-fall-mentor-guide.pdf",
  },
  {
    title: "2026 秋季她行活动 Mentee 守则",
    href: "/documents/2026-fall-mentee-guide.pdf",
  },
];

export default function ActivitiesPage() {
  const { currentUser, realUser } = usePortalSession();
  const queryClient = useQueryClient();
  const { data: cohorts } = useQuery({
    queryKey: ["portal", "cohorts"],
    queryFn: listCohorts,
  });

  const myCohorts = (cohorts ?? []).filter((c) =>
    currentUser?.cohort_ids.includes(c.id),
  );
  // The timeline below is pinned to one season, and so are its 子活动 — not
  // the newest cohort, which changes the moment the next season is created.
  const timelineCohortId = cohorts?.some((c) => c.id === TIMELINE_COHORT_ID)
    ? TIMELINE_COHORT_ID
    : undefined;
  const { items: subItems, canEdit, now } = useActivityItems(timelineCohortId);
  const { rows, overriddenKeys } = useTimelineRows(timelineCohortId);
  // Row dates are writable by admins (负责人) only (0041), unlike 子活动.
  const canEditDates =
    Boolean(currentUser?.is_admin) && Boolean(timelineCohortId);
  const today = programDay(new Date(now));
  const span = timelineSpan(rows);
  const hasSessions = subItems.some((i) => i.kind === "session");

  // Rows the viewer switched from 日历 to 列表; calendar is the default.
  const [listView, setListView] = React.useState<Set<string>>(() => new Set());
  const toggleView = (key: string, view: "list" | "calendar") =>
    setListView((prev) => {
      const next = new Set(prev);
      if (view === "list") next.add(key);
      else next.delete(key);
      return next;
    });

  const [datesRow, setDatesRow] = React.useState<TimelineRow | null>(null);
  const [datesOpen, setDatesOpen] = React.useState(false);

  const [dialog, setDialog] = React.useState<{
    parent: TimelineRow;
    item: ActivityItem | null;
  } | null>(null);
  // Kept apart from `dialog` so the title does not change while it fades out.
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const openDialog = (parent: TimelineRow, item: ActivityItem | null) => {
    setDialog({ parent, item });
    setDialogOpen(true);
  };

  const renderSection = (section: Section) => (
    <Paper key={section.key} sx={{ p: 3, borderRadius: 3 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        {section.icon}
        <Typography variant="h6" fontWeight={700}>
          {section.label}
        </Typography>
      </Stack>
      <Divider sx={{ my: 2 }} />
      {section.key === "files" ? (
        <Stack spacing={1.5}>
          {importantFiles.map((file) => (
            <Stack
              key={file.href}
              direction="row"
              alignItems="center"
              spacing={1.25}
              sx={{
                p: 1.5,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "#fffaf2",
              }}
            >
              <PictureAsPdfOutlinedIcon color="secondary" />
              <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>
                {file.title}
              </Typography>
              <Button
                component="a"
                href={file.href}
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                variant="outlined"
                color="secondary"
                endIcon={<OpenInNewIcon />}
                sx={{ flexShrink: 0 }}
              >
                {portalCopy.activities.openPdf}
              </Button>
            </Stack>
          ))}
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {rows
            .filter((activity) => activity.track === section.key)
            .map((activity) => {
              const phase = rowPhase(activity, today);
              const rowItems = subItems.filter(
                (i) => i.parent_key === activity.key,
              );
              return (
                <Box
                  key={activity.key}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor:
                      section.key === "main" ? "#fff7e8" : "#f8fafc",
                    border:
                      phase === "current" ? "2px solid" : "1px solid",
                    borderColor:
                      phase === "current"
                        ? "secondary.main"
                        : section.key === "main"
                          ? "#fbd9a3"
                          : "divider",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    spacing={1}
                  >
                    <Box sx={{ opacity: phase === "past" ? 0.7 : 1 }}>
                      <Typography fontWeight={700}>
                        {activity.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatRange(activity.from, activity.to)}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                    >
                      {activity.calendar && rowItems.some((i) => i.kind === "session") && (
                        <ToggleButtonGroup
                          exclusive
                          size="small"
                          value={listView.has(activity.key) ? "list" : "calendar"}
                          onChange={(_, v: "list" | "calendar" | null) => v && toggleView(activity.key, v)}
                          sx={{ display: { xs: "none", md: "inline-flex" }, mr: 0.5 }}
                        >
                          <ToggleButton value="calendar" aria-label={portalCopy.activities.calendar.viewCalendar} sx={{ py: 0.25 }}>
                            <CalendarMonthOutlinedIcon fontSize="small" />
                          </ToggleButton>
                          <ToggleButton value="list" aria-label={portalCopy.activities.calendar.viewList} sx={{ py: 0.25 }}>
                            <ViewListOutlinedIcon fontSize="small" />
                          </ToggleButton>
                        </ToggleButtonGroup>
                      )}
                      {phase !== "upcoming" && (
                        <Chip
                          size="small"
                          variant={
                            phase === "current" ? "filled" : "outlined"
                          }
                          color={
                            phase === "current" ? "secondary" : "default"
                          }
                          label={
                            portalCopy.activities.browse.rowPhase[phase]
                          }
                        />
                      )}
                      <Chip
                        size="small"
                        label={activity.week}
                        color={
                          section.key === "main" ? "primary" : "default"
                        }
                        // 支线 weeks in blue: the default grey read as disabled.
                        sx={{
                          fontWeight: 700,
                          ...(section.key === "side" && {
                            bgcolor: "#dbeafe",
                            color: "#1e40af",
                          }),
                        }}
                      />
                      {canEditDates && (
                        <Tooltip
                          title={portalCopy.activities.datesDialog.edit}
                        >
                          <IconButton
                            size="small"
                            aria-label={
                              portalCopy.activities.datesDialog.edit
                            }
                            onClick={() => {
                              setDatesRow(activity);
                              setDatesOpen(true);
                            }}
                          >
                            <EditCalendarOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEdit && (
                        <Tooltip
                          title={portalCopy.activities.subItems.add}
                        >
                          <IconButton
                            size="small"
                            color="secondary"
                            aria-label={
                              portalCopy.activities.subItems.add
                            }
                            onClick={() => openDialog(activity, null)}
                          >
                            <AddIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>
                  {activity.calendar && rowItems.some((i) => i.kind === "session") ? (
                    <>
                      {/* Calendar on md+ when chosen; phones always get the list. */}
                      <Box sx={{ display: listView.has(activity.key) ? "block" : { xs: "block", md: "none" } }}>
                        <ActivitySubItems
                          items={rowItems}
                          canEdit={canEdit}
                          now={now}
                          onEdit={(item) => openDialog(activity, item)}
                        />
                      </Box>
                      {!listView.has(activity.key) && (
                        <Box sx={{ display: { xs: "none", md: "block" } }}>
                          <ActivitySubItems
                            items={rowItems.filter((i) => i.kind === "link")}
                            canEdit={canEdit}
                            now={now}
                            onEdit={(item) => openDialog(activity, item)}
                          />
                          <ActivitySessionCalendar
                            row={activity}
                            sessions={rowItems.filter((i) => i.kind === "session")}
                            sheetUrl={rowSheetUrl(rowItems)}
                            now={now}
                            canEdit={canEdit}
                            onEdit={(item) => openDialog(activity, item)}
                          />
                        </Box>
                      )}
                    </>
                  ) : (
                    <ActivitySubItems
                      items={rowItems}
                      canEdit={canEdit}
                      now={now}
                      onEdit={(item) => openDialog(activity, item)}
                    />
                  )}
                </Box>
              );
            })}
        </Stack>
      )}
    </Paper>
  );

  return (
    <Box sx={{ maxWidth: { xs: 880, lg: 1440 } }}>
      <Typography variant="h4" fontWeight={800} gutterBottom>
        {portalCopy.activities.title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {portalCopy.activities.subtitle}
      </Typography>
      <Typography fontWeight={700} color="primary.dark" sx={{ mb: 1 }}>
        {span &&
          portalCopy.activities.timelineHeading(
            `${formatFullDay(span.from)} – ${formatFullDay(span.to)}`,
          )}
      </Typography>
      {myCohorts.length > 0 && (
        <Typography color="text.secondary" sx={{ mb: hasSessions ? 0.5 : 3 }}>
          所在项目：{myCohorts.map((c) => c.name).join("、")}
        </Typography>
      )}
      {hasSessions && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {portalCopy.activities.browse.zoneNote(viewerZoneName())}
        </Typography>
      )}

      {/* Wide screens: the timeline on the left, 接下来 and 重要文件 in a
          sticky column on the right. Narrow: one column, that column first. */}
      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" },
          alignItems: "start",
        }}
      >
        <Stack
          spacing={3}
          sx={{
            gridColumn: { lg: 2 },
            gridRow: { lg: 1 },
            position: { lg: "sticky" },
            top: { lg: 88 },
            // Taller than the window, a sticky column would hide its bottom
            // until the timeline ran out; scroll it on its own instead.
            maxHeight: { lg: "calc(100vh - 112px)" },
            overflowY: { lg: "auto" },
          }}
        >
          <UpNext items={subItems} rows={rows} now={now} />
          {sections.filter((sec) => sec.key === "files").map(renderSection)}
        </Stack>
        <Stack spacing={3} sx={{ gridColumn: { lg: 1 }, gridRow: { lg: 1 }, minWidth: 0 }}>
          {sections.filter((sec) => sec.key !== "files").map(renderSection)}
        </Stack>
      </Box>

      {canEdit && timelineCohortId && realUser && dialog && (
        <ActivityItemDialog
          open={dialogOpen}
          item={dialog.item}
          parent={
            rows.find((r) => r.key === dialog.parent.key) ?? dialog.parent
          }
          rows={rows}
          cohortId={timelineCohortId}
          createdBy={realUser.id}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            void queryClient.invalidateQueries({
              queryKey: activityItemsKey(timelineCohortId),
            });
          }}
        />
      )}
      {canEditDates && timelineCohortId && realUser && datesRow && (
        <TimelineDatesDialog
          open={datesOpen}
          row={rows.find((r) => r.key === datesRow.key) ?? datesRow}
          overridden={overriddenKeys.has(datesRow.key)}
          items={subItems.filter((i) => i.parent_key === datesRow.key)}
          cohortId={timelineCohortId}
          updatedBy={realUser.id}
          onClose={() => setDatesOpen(false)}
          onSaved={() => {
            setDatesOpen(false);
            void queryClient.invalidateQueries({
              queryKey: timelineDatesKey(timelineCohortId),
            });
          }}
        />
      )}
    </Box>
  );
}
