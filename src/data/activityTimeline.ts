import type { ActivityItemKind, ActivityTimelineDates } from "@/types/portal";

/**
 * The season this timeline describes (2026秋季). Its sub-items are read and
 * written for this cohort only, so creating the next season early does not
 * swap them out from under the 2026 timeline. Change it together with the rows
 * below when the timeline is rewritten.
 */
export const TIMELINE_COHORT_ID = "82247838-461c-4674-9ae3-be0cc1711c2a";

/**
 * Row dates are program dates in this zone. A session is placed by its date
 * here — not in the editor's own zone — so re-saving it from another time zone
 * never moves it to a different row.
 */
export const PROGRAM_TIME_ZONE = "Asia/Shanghai";

const programDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: PROGRAM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** A moment → its `YYYY-MM-DD` in PROGRAM_TIME_ZONE. */
export function programDay(moment: Date): string {
  return programDayFormat.format(moment);
}

/** One row of the 主线 / 支线 timeline on /portal/activities. */
export type TimelineRow = {
  /**
   * Stable within a season: 子活动 hang under a row by this key
   * (`activity_items.parent_key`, 0038). Renaming a key orphans its rows.
   */
  key: string;
  /**
   * Rows of one recurring activity share a series (the two 圆桌分享会 rows).
   * A session is placed in the row of its series whose dates cover it,
   * whichever row's ＋ was clicked. Defaults to the row's own key.
   */
  series?: string;
  /** What the add dialog starts on for this row. */
  defaultKind: ActivityItemKind;
  /**
   * Show the row's sessions as a month calendar on wider screens (with a
   * 日历 / 列表 switch), for rows with many short entries like Office Hour.
   */
  calendar?: boolean;
  /**
   * How long one of this row's sessions runs. Sessions have no end time, so
   * this is how long the 进行中 chip shows after the start. Defaults to
   * DEFAULT_SESSION_MINUTES.
   */
  sessionMinutes?: number;
  /** This row's sessions are never recorded (Office Hour): no 录屏 field, no 录屏整理中 note. */
  noRecording?: boolean;
  week: string;
  /** Inclusive, `YYYY-MM-DD`, in PROGRAM_TIME_ZONE. */
  from: string;
  to: string;
  title: string;
  track: "main" | "side";
};

/** Session length for rows that do not set `sessionMinutes`. */
export const DEFAULT_SESSION_MINUTES = 180;

export const timelineRows: TimelineRow[] = [
  { key: "icebreak", defaultKind: "session", week: "Week 0–1", from: "2026-10-10", to: "2026-10-18", title: "成员破冰", track: "main" },
  { key: "training", defaultKind: "link", week: "Week 0–1", from: "2026-10-10", to: "2026-10-18", title: "自主培训", track: "main" },
  { key: "qa_group", defaultKind: "link", week: "Week 2–3", from: "2026-10-19", to: "2026-11-01", title: "Mentor 答疑组活动", track: "main" },
  { key: "pairing", defaultKind: "link", week: "Week 4", from: "2026-11-02", to: "2026-11-08", title: "Mentor–Mentee 1v1 配对", track: "main" },
  { key: "roundtable_w4", series: "roundtable", defaultKind: "session", week: "Week 4", from: "2026-11-02", to: "2026-11-08", title: "圆桌分享会", track: "side" },
  { key: "one_on_one", defaultKind: "link", week: "Week 5–7", from: "2026-11-09", to: "2026-11-29", title: "Mentor–Mentee 1v1 交流", track: "main" },
  { key: "office_hour", defaultKind: "session", calendar: true, sessionMinutes: 60, noRecording: true, week: "Week 5–8", from: "2026-11-09", to: "2026-12-06", title: "Office Hour 活动", track: "side" },
  { key: "roundtable_w5_7", series: "roundtable", defaultKind: "session", week: "Week 5–7", from: "2026-11-09", to: "2026-11-29", title: "圆桌分享会", track: "side" },
  { key: "graduation", defaultKind: "session", week: "Week 8", from: "2026-11-30", to: "2026-12-06", title: "毕业活动", track: "side" },
];

/** `2026-11-02` → `11月2日`. */
function formatDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${m}月${d}日`;
}

export function formatRange(from: string, to: string): string {
  return `${formatDay(from)} – ${formatDay(to)}`;
}

/**
 * The timeline with an admin's date overrides (0041) applied, in date order
 * (code order breaks ties). Rows without an override keep their defaults.
 */
export function applyTimelineDates(overrides: ActivityTimelineDates[]): TimelineRow[] {
  const byKey = new Map(overrides.map((o) => [o.row_key, o]));
  return timelineRows
    .map((row, index) => {
      const o = byKey.get(row.key);
      const merged = o ? { ...row, from: o.from_day, to: o.to_day, week: o.week_label } : row;
      return { row: merged, index };
    })
    .sort((a, b) => a.row.from.localeCompare(b.row.from) || a.index - b.index)
    .map(({ row }) => row);
}

/** The defaults in code for `key`, before any override. */
export function defaultTimelineRow(key: string): TimelineRow | undefined {
  return timelineRows.find((r) => r.key === key);
}

/** First and last program day across `rows`. */
export function timelineSpan(rows: TimelineRow[]): { from: string; to: string } | null {
  if (rows.length === 0) return null;
  return {
    from: rows.reduce((m, r) => (r.from < m ? r.from : m), rows[0].from),
    to: rows.reduce((m, r) => (r.to > m ? r.to : m), rows[0].to),
  };
}

/** `2026-11-02` → `2026年11月2日`. */
export function formatFullDay(day: string): string {
  const [y] = day.split("-");
  return `${y}年${formatDay(day)}`;
}

export type RowPhase = "past" | "current" | "upcoming";

/** Where `row` sits relative to program day `today`. */
export function rowPhase(row: TimelineRow, today: string): RowPhase {
  if (today < row.from) return "upcoming";
  if (today > row.to) return "past";
  return "current";
}

/** The rows a session added from `row` may land in, in timeline order. */
export function seriesRows(rows: TimelineRow[], row: TimelineRow): TimelineRow[] {
  const series = row.series ?? row.key;
  return rows.filter((r) => (r.series ?? r.key) === series);
}

/**
 * Where a session on program day `day` (`YYYY-MM-DD`, see programDay) belongs:
 * the clicked row if it covers the day, else the first row of its series that
 * does, else null. `rows` is the timeline with overrides applied.
 */
export function placeSession(
  rows: TimelineRow[],
  row: TimelineRow,
  day: string,
): TimelineRow | null {
  const covers = (r: TimelineRow) => r.from <= day && day <= r.to;
  if (covers(row)) return row;
  return seriesRows(rows, row).find(covers) ?? null;
}

const sessionMinutesByKey = new Map(
  timelineRows.flatMap((row) => (row.sessionMinutes ? [[row.key, row.sessionMinutes] as const] : [])),
);

const noRecordingKeys = new Set(timelineRows.filter((r) => r.noRecording).map((r) => r.key));

/** Whether sessions under this row get a recording at all. */
export function isRecorded(parentKey: string): boolean {
  return !noRecordingKeys.has(parentKey);
}

/** How long a session under this row runs (Office Hour: one hour). */
export function sessionMinutesFor(parentKey: string): number {
  return sessionMinutesByKey.get(parentKey) ?? DEFAULT_SESSION_MINUTES;
}
