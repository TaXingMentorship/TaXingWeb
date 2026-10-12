/**
 * Red used for 「新评论」 markers. A literal rather than the theme's `error`
 * colour: `src/theme.ts` sets `error.main` to the invalid string '#red', so
 * `color="error"` / `error.main` render with no background — which left white
 * numbers on a transparent badge.
 */
export const UNREAD_BG = "#D32F2F";
export const unreadChipSx = { bgcolor: UNREAD_BG, color: "#fff" } as const;
