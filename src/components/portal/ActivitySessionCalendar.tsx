"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import ButtonBase from "@mui/material/ButtonBase";
import Popover from "@mui/material/Popover";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VideocamOutlinedIcon from "@mui/icons-material/VideocamOutlined";
import type { ActivityItem } from "@/types/portal";
import LinkifiedText from "@/components/portal/board/LinkifiedText";
import {
  formatClock,
  formatSessionTime,
  SessionLinks,
  sessionStatus,
  viewerDayKey,
} from "@/components/portal/ActivitySubItems";
import { portalCopy } from "@/data/portalCopy";
import { programDaySpan, type TimelineRow } from "@/data/activityTimeline";

// Days are the viewer's own, like the times — a session at 01:00 for her sits
// in that day's cell, wherever the program's zone puts it. The row's program
// dates are converted the same way, so the shaded range matches the cells.

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` → a UTC midnight, for plain calendar arithmetic. */
function dayToUtc(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Monday-first weekday, 0–6. */
function weekdayIndex(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

/**
 * The part of a title worth a calendar cell: `【Office Hour】嘉宾：小爽` → `小爽`.
 * Drops a leading 【…】 tag and a 嘉宾： label, which every entry of a row repeats.
 */
export function shortSessionTitle(title: string): string {
  const stripped = title
    .replace(/^\s*【[^】]*】\s*/, "")
    .replace(/^嘉宾\s*[:：]\s*/, "")
    .trim();
  return stripped || title;
}

/**
 * A row's sessions on a Monday-first month grid, one week per line, covering
 * the row's dates (and any session the viewer's zone puts just outside them).
 * Each entry is time + short title; clicking it opens the summary and links.
 */
export default function ActivitySessionCalendar({
  row,
  sessions,
  now,
  canEdit,
  onEdit,
  sheetUrl,
}: {
  row: TimelineRow;
  /** The row's 总表 (rowSheetUrl), shown above the grid by the page. */
  sheetUrl: string | null;
  sessions: ActivityItem[];
  now: number;
  canEdit: boolean;
  onEdit: (item: ActivityItem) => void;
}) {
  const copy = portalCopy.activities.calendar;
  const [open, setOpen] = React.useState<{ el: HTMLElement; item: ActivityItem } | null>(null);

  const byDay = new Map<string, ActivityItem[]>();
  for (const s of sessions) {
    const key = viewerDayKey(new Date(s.starts_at!));
    const list = byDay.get(key);
    if (list) list.push(s);
    else byDay.set(key, [s]);
  }
  // Every viewer day that overlaps the row's program days.
  const rowFrom = viewerDayKey(new Date(programDaySpan(row.from).start));
  const rowTo = viewerDayKey(new Date(programDaySpan(row.to).end - 1));
  const sessionDays = [...byDay.keys()].sort();
  const first = [rowFrom, sessionDays[0]].filter(Boolean).sort()[0]!;
  const last = [rowTo, sessionDays[sessionDays.length - 1]].filter(Boolean).sort().reverse()[0]!;

  const start = dayToUtc(first) - weekdayIndex(dayToUtc(first)) * DAY_MS;
  const endMs = dayToUtc(last);
  const end = endMs + (6 - weekdayIndex(endMs)) * DAY_MS;
  const weeks: string[][] = [];
  for (let ms = start; ms <= end; ms += 7 * DAY_MS) {
    weeks.push(Array.from({ length: 7 }, (_, i) => utcToDay(ms + i * DAY_MS)));
  }
  const today = viewerDayKey(new Date(now));
  // Point to the 总表 only when no session carries its own meeting link.
  const hint = sheetUrl && !sessions.some((s) => s.meeting_url) ? copy.hintWithSheet : copy.hint;

  const selected = open?.item;
  const selectedPast = selected ? sessionStatus(selected.starts_at!, now) === "past" : false;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
        {hint}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        {copy.weekdays.map((w) => (
          <Typography
            key={w}
            variant="caption"
            fontWeight={700}
            color="text.secondary"
            sx={{ textAlign: "center", py: 0.75, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#fffaf2" }}
          >
            {w}
          </Typography>
        ))}
        {weeks.flat().map((day, i) => {
          const inRow = rowFrom <= day && day <= rowTo;
          const isToday = day === today;
          const [, m, d] = day.split("-").map(Number);
          const items = byDay.get(day) ?? [];
          return (
            <Box
              key={day}
              sx={{
                minHeight: 84,
                p: 0.75,
                borderTop: i >= 7 ? "1px solid" : "none",
                borderLeft: i % 7 ? "1px solid" : "none",
                borderColor: "divider",
                bgcolor: isToday ? "#fff3dc" : inRow ? "transparent" : "#fafafa",
                minWidth: 0,
              }}
            >
              {/* Month on the first cell of each week and on the 1st, so the
                  11月 → 12月 turn stands out; plain day numbers elsewhere. */}
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5, minHeight: 22 }}>
                {(i % 7 === 0 || d === 1) && (
                  <Box
                    component="span"
                    sx={{
                      px: 0.75,
                      borderRadius: 1,
                      fontSize: 12,
                      fontWeight: 700,
                      lineHeight: "20px",
                      bgcolor: d === 1 ? "secondary.main" : "#fde7c2",
                      color: d === 1 ? "secondary.contrastText" : "primary.dark",
                    }}
                  >
                    {m}月
                  </Box>
                )}
                <Typography
                  variant="body2"
                  fontWeight={isToday ? 800 : 700}
                  color={isToday ? "secondary.main" : inRow ? "text.primary" : "text.disabled"}
                >
                  {d}
                </Typography>
                {isToday && (
                  <Typography variant="caption" fontWeight={700} color="secondary.main">
                    {copy.today}
                  </Typography>
                )}
              </Stack>
              <Stack spacing={0.5}>
                {items.map((item) => {
                  const status = sessionStatus(item.starts_at!, now);
                  const past = status === "past";
                  return (
                    <ButtonBase
                      key={item.id}
                      onClick={(e) => setOpen({ el: e.currentTarget, item })}
                      title={item.title}
                      sx={{
                        justifyContent: "flex-start",
                        textAlign: "left",
                        px: 0.75,
                        py: 0.25,
                        borderRadius: 1,
                        bgcolor: status === "live" ? "secondary.main" : past ? "#f1f1f1" : "#fff1d6",
                        color: status === "live" ? "secondary.contrastText" : past ? "text.secondary" : "text.primary",
                        "&:hover": { filter: "brightness(0.95)" },
                        minWidth: 0,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                      >
                        <Box component="span" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", mr: 0.5 }}>
                          {formatClock(item.starts_at!)}
                        </Box>
                        {shortSessionTitle(item.title)}
                      </Typography>
                      {!past && item.meeting_url && (
                        <VideocamOutlinedIcon
                          aria-label={portalCopy.activities.subItems.meeting}
                          sx={{ fontSize: 14, ml: "auto", pl: 0.25, flexShrink: 0, color: status === "live" ? "inherit" : "secondary.main" }}
                        />
                      )}
                    </ButtonBase>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>

      <Popover
        open={Boolean(open)}
        anchorEl={open?.el}
        onClose={() => setOpen(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 360, borderRadius: 2 } } }}
      >
        {selected && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" fontWeight={700} color="primary.dark">
                {formatSessionTime(selected.starts_at!)}
              </Typography>
              {sessionStatus(selected.starts_at!, now) !== "upcoming" && (
                <Chip
                  size="small"
                  color={selectedPast ? "default" : "primary"}
                  label={portalCopy.activities.subItems.status[sessionStatus(selected.starts_at!, now)]}
                />
              )}
            </Stack>
            <Typography variant="body2" fontWeight={700}>
              {selected.title}
            </Typography>
            {selected.summary && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                <LinkifiedText text={selected.summary} />
              </Typography>
            )}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <SessionLinks item={selected} past={selectedPast} sheetUrl={sheetUrl} />
              {canEdit && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={<EditOutlinedIcon fontSize="small" />}
                  onClick={() => {
                    setOpen(null);
                    onEdit(selected);
                  }}
                >
                  {portalCopy.activities.subItems.edit}
                </Button>
              )}
            </Stack>
          </Stack>
        )}
      </Popover>
    </Box>
  );
}
