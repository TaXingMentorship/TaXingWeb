import type { MentorGroup } from "@/types/portal";

/**
 * Fourteen colours for the Q&A answer groups, as seen on the directory cards.
 *
 * Six hue families, one per direction (软件工程 blue, 产品经理 orange, 数据分析
 * aqua, 市场营销 green, 人工智能 violet, 智能制造 magenta); the groups of one
 * direction are lighter-to-darker shades of its hue, in group order. The six
 * hues are the validated categorical set (no colour-blind warning between
 * neighbours); each multi-group family is a one-hue ordinal ramp that passes
 * the ramp checks. Fourteen unrelated hues cannot all be told apart, so colour
 * is never the only signal: the chip always carries the group's name.
 *
 * `text` on `bg` is 8.7:1 or better. The dot and border are the shade itself.
 * Red and yellow are left out on purpose; they belong to status.
 */
export type MentorGroupColor = { dot: string; bg: string; text: string };

const blue = { bg: "#e1f2ff", text: "#013b7a" };
const orange = { bg: "#ffe9df", text: "#6e1e00" };
const aqua = { bg: "#dcf8e9", text: "#004f28" };
const green = { bg: "#e3f7e1", text: "#034b02" };
const violet = { bg: "#eceeff", text: "#383079" };
const magenta = { bg: "#ffe7f0", text: "#6a183d" };

export const MENTOR_GROUP_COLORS: readonly MentorGroupColor[] = [
  { dot: "#4693f3", ...blue },
  { dot: "#1467c3", ...blue },
  { dot: "#f5713e", ...orange },
  { dot: "#d95821", ...orange },
  { dot: "#bd3d00", ...orange },
  { dot: "#1baf7a", ...aqua },
  { dot: "#008300", ...green },
  { dot: "#8780f4", ...violet },
  { dot: "#6b61d1", ...violet },
  { dot: "#5142b0", ...violet },
  { dot: "#ed7fa8", ...magenta },
  { dot: "#d26891", ...magenta },
  { dot: "#b8507a", ...magenta },
  { dot: "#9f3964", ...magenta },
];

/**
 * A colour per group of one season, by the group's place in the season's order
 * (`sort_order`, then name). It follows the group, not the number of groups on
 * screen, so filtering the directory never repaints a group. More than fourteen
 * groups wrap around.
 */
export function mentorGroupColors(groups: MentorGroup[]): Map<string, MentorGroupColor> {
  const ordered = [...groups].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "zh"),
  );
  return new Map(
    ordered.map((group, index) => [group.id, MENTOR_GROUP_COLORS[index % MENTOR_GROUP_COLORS.length]]),
  );
}
