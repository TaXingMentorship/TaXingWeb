"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { listTimelineDates } from "@/lib/portal/store";
import { applyTimelineDates, type TimelineRow } from "@/data/activityTimeline";

export const timelineDatesKey = (cohortId: string | undefined) =>
  ["portal", "timelineDates", cohortId] as const;

/**
 * The timeline rows with admins' date overrides (0041) applied, plus which
 * rows have one (so the edit dialog can offer 恢复默认). Until the overrides
 * load, the code's defaults are shown.
 */
export function useTimelineRows(cohortId: string | undefined): {
  rows: TimelineRow[];
  overriddenKeys: Set<string>;
} {
  const { data } = useQuery({
    queryKey: timelineDatesKey(cohortId),
    queryFn: () => listTimelineDates(cohortId!),
    enabled: Boolean(cohortId),
  });
  return React.useMemo(
    () => ({
      rows: applyTimelineDates(data ?? []),
      overriddenKeys: new Set((data ?? []).map((d) => d.row_key)),
    }),
    [data],
  );
}
