import type { ActivityItemKind } from "@/types/portal";

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
  week: string;
  /** Inclusive, `YYYY-MM-DD`, in PROGRAM_TIME_ZONE. */
  from: string;
  to: string;
  title: string;
  track: "main" | "side";
};

export const timelineRows: TimelineRow[] = [
  { key: "icebreak", defaultKind: "session", week: "Week 0–1", from: "2026-10-10", to: "2026-10-18", title: "成员破冰", track: "main" },
  { key: "training", defaultKind: "link", week: "Week 0–1", from: "2026-10-10", to: "2026-10-18", title: "自主培训", track: "main" },
  { key: "qa_group", defaultKind: "link", week: "Week 2–3", from: "2026-10-19", to: "2026-11-01", title: "Mentor 答疑组活动", track: "main" },
  { key: "pairing", defaultKind: "link", week: "Week 4", from: "2026-11-02", to: "2026-11-08", title: "Mentor–Mentee 1v1 配对", track: "main" },
  { key: "roundtable_w4", series: "roundtable", defaultKind: "session", week: "Week 4", from: "2026-11-02", to: "2026-11-08", title: "圆桌分享会", track: "side" },
  { key: "one_on_one", defaultKind: "link", week: "Week 5–7", from: "2026-11-09", to: "2026-11-29", title: "Mentor–Mentee 1v1 交流", track: "main" },
  { key: "office_hour", defaultKind: "session", week: "Week 5–8", from: "2026-11-09", to: "2026-12-06", title: "Office Hour 活动", track: "side" },
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

/** The rows a session added from `row` may land in, in timeline order. */
export function seriesRows(row: TimelineRow): TimelineRow[] {
  const series = row.series ?? row.key;
  return timelineRows.filter((r) => (r.series ?? r.key) === series);
}

/**
 * Where a session on program day `day` (`YYYY-MM-DD`, see programDay) belongs:
 * the clicked row if it covers the day, else the first row of its series that
 * does, else null.
 */
export function placeSession(row: TimelineRow, day: string): TimelineRow | null {
  const covers = (r: TimelineRow) => r.from <= day && day <= r.to;
  if (covers(row)) return row;
  return seriesRows(row).find(covers) ?? null;
}
