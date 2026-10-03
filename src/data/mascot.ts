/**
 * Where the feedback mascot sends people. These are the Fall board's ids from
 * production; point them at the next season's board when it replaces this one.
 */
export const MASCOT_FEEDBACK_HREF =
  "/portal/board?cohort=82247838-461c-4674-9ae3-be0cc1711c2a&board=8fd0a644-eb49-4334-b6eb-d717d3bf28f0";

export type Season = "spring" | "summer" | "autumn" | "winter";

export function seasonOf(date: Date = new Date()): Season {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

/**
 * The seasonal "hat" floating over her head: one piece per unfinished task.
 * A season with no entry gets no hat — add one here (and a drawing in
 * MascotHat.tsx) when its turn comes.
 */
export const MASCOT_HATS: Partial<Record<Season, "maple">> = {
  autumn: "maple",
};

/** Most pieces drawn at once; extra tasks are still counted in the bubble. */
export const MASCOT_HAT_MAX = 6;
