"use client";

import * as React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { MentorGroup } from "@/types/portal";
import { alpha, type Theme } from "@mui/material/styles";
import { UNREAD_BG } from "./unreadStyle";
import { portalCopy } from "@/data/portalCopy";

/** `value` is a group id, or this for the viewer's own posts. */
export const MINE = "__mine";
/**
 * Posts with no group: asked before the board became a Q&A board, or left
 * behind when their group was deleted (0028 sets group_id to null). Listed only
 * when there are some, so they never become unreachable.
 */
export const UNGROUPED = "__ungrouped";

/**
 * Group navigation for a Q&A board: 「我的提问」 first, then the season's groups
 * under their 方向. A list beside the wall from `md` up, a select above it on
 * phones — both are plain CSS breakpoints, per CLAUDE.md.
 */
export default function GroupSidebar({
  groups,
  value,
  postCounts,
  mineCount,
  unreadByGroup,
  mineUnread,
  ungroupedCount = 0,
  ungroupedUnread = 0,
  onSelect,
}: {
  groups: MentorGroup[];
  value: string;
  postCounts: Record<string, number>;
  mineCount: number;
  /** Unread comments on the viewer's own posts, per group and in total. */
  unreadByGroup: Record<string, number>;
  mineUnread: number;
  ungroupedCount?: number;
  ungroupedUnread?: number;
  onSelect: (value: string) => void;
}) {
  const sections = React.useMemo(() => {
    const out: { direction: string; groups: MentorGroup[] }[] = [];
    for (const group of groups) {
      const direction = group.direction ?? "";
      const last = out[out.length - 1];
      if (last && last.direction === direction) last.groups.push(group);
      else out.push({ direction, groups: [group] });
    }
    return out;
  }, [groups]);

  if (groups.length === 0 && ungroupedCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {portalCopy.board.groupNavEmpty}
      </Typography>
    );
  }

  return (
    <>
      <Box sx={{ display: { xs: "block", md: "none" }, mb: 2, width: "100%" }}>
        <TextField
          select
          size="small"
          fullWidth
          value={value}
          onChange={(e) => onSelect(e.target.value)}
        >
          <MenuItem value={MINE}>{portalCopy.board.groupMine}</MenuItem>
          {sections.flatMap((section) => [
            ...(section.direction
              ? [
                  <ListSubheader key={`h-${section.direction}`} sx={{ lineHeight: "32px" }}>
                    {section.direction}
                  </ListSubheader>,
                ]
              : []),
            ...section.groups.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            )),
          ])}
          {ungroupedCount > 0 && (
            <MenuItem value={UNGROUPED}>{portalCopy.board.groupUngrouped}</MenuItem>
          )}
        </TextField>
      </Box>

      <Box
        component="nav"
        aria-label="答疑组"
        sx={{ display: { xs: "none", md: "block" }, width: 264, flexShrink: 0 }}
      >
        <NavItem
          featured
          selected={value === MINE}
          onClick={() => onSelect(MINE)}
          count={mineCount}
          unread={mineUnread}
        >
          <PersonOutlineIcon sx={{ fontSize: 20, mr: 0.75, verticalAlign: "-4px" }} />
          {portalCopy.board.groupMine}
        </NavItem>

        {sections.map((section) => {
          const single =
            section.groups.length === 1 && section.groups[0].name === section.direction;
          return (
            <Box key={section.direction || "_"} sx={{ mt: 1.25 }}>
              {single ? (
                // A 方向 with one group and nothing under it: the heading bar is
                // itself the item, styled exactly like every other 大组.
                <NavItem
                  section
                  selected={value === section.groups[0].id}
                  onClick={() => onSelect(section.groups[0].id)}
                  count={postCounts[section.groups[0].id] || 0}
                  unread={unreadByGroup[section.groups[0].id] || 0}
                >
                  {section.groups[0].name}
                </NavItem>
              ) : (
                <>
                  {section.direction && (
                    <Box sx={{ ...SECTION_BAR, display: "block", mb: 0.5 }}>
                      {section.direction}
                    </Box>
                  )}
                  {/* A row's text sits ~8.5px above its box's bottom edge; pulling the
                      next 大组 bar up by that much makes the visible gap before it
                      equal the 10px between two single-group bars. */}
                  <Box sx={{ ml: 1.25, pl: 0.75, mb: "-8.5px", borderLeft: "1px solid", borderColor: "divider" }}>
                    {section.groups.map((g, i) => (
                      <NavItem
                        key={g.id}
                        selected={value === g.id}
                        onClick={() => onSelect(g.id)}
                        count={postCounts[g.id] || 0}
                        unread={unreadByGroup[g.id] || 0}
                      >
                        {shortName(g, i, section.groups.length)}
                      </NavItem>
                    ))}
                  </Box>
                </>
              )}
            </Box>
          );
        })}

        {ungroupedCount > 0 && (
          <Box sx={{ mt: 1.25 }}>
            <NavItem
              section
              selected={value === UNGROUPED}
              onClick={() => onSelect(UNGROUPED)}
              count={ungroupedCount}
              unread={ungroupedUnread}
            >
              {portalCopy.board.groupUngrouped}
            </NavItem>
          </Box>
        )}
      </Box>
    </>
  );
}

/**
 * The name without its 方向 prefix, since the heading already says it:
 * 「产品经理与产品策略类 2」 under 「产品经理与产品策略类」 reads 「组 2」. A group
 * named exactly like its 方向 inside a multi-group section is the first of them.
 */
function shortName(group: MentorGroup, index: number, size: number): string {
  const direction = group.direction ?? "";
  if (!direction || !group.name.startsWith(direction)) return group.name;
  const rest = group.name.slice(direction.length).trim();
  if (/^\d+$/.test(rest)) return `组 ${rest}`;
  if (rest === "" && size > 1) return `组 ${index + 1}`;
  return rest || group.name;
}

/**
 * Selected state: a pale orange fill, dark brown text and an orange edge. Fixed
 * colours rather than theme ones — the board page repaints `secondary` as the
 * light #FEBD59, on which white text had too little contrast. #FD7E14 is the
 * site's own orange (src/theme.ts).
 */
const SELECTED = { bg: "#FFE7BF", bgHover: "#FFDCA3", fg: "#7A3E00", accent: "#FD7E14" } as const;

/** The tinted bar with an orange edge that heads each 方向. */
const SECTION_BAR = {
  fontSize: 14,
  px: 1.25,
  py: 0.5,
  borderRadius: 1.5,
  bgcolor: (theme: Theme) => alpha(theme.palette.secondary.main, 0.16),
  borderLeft: "3px solid",
  borderColor: "secondary.main",
  // Fixed, not inherited: the heading is a plain box and the single-group form
  // is a button, and their type must come out identical (a `caption` Typography
  // used to add letter-spacing the button did not have).
  fontWeight: 800,
  lineHeight: "20px",
  letterSpacing: "normal",
  wordBreak: "break-word",
} as const;

function NavItem({
  selected,
  onClick,
  count,
  unread = 0,
  section = false,
  featured = false,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  count: number;
  unread?: number;
  /** Render as a 大组 heading bar that is itself selectable. */
  section?: boolean;
  /** 「我的提问」: an outlined card with an icon, so it does not read as just another row. */
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-current={selected ? "true" : undefined}
      sx={{
        // A bare ButtonBase falls back to the browser's button font (Arial),
        // which made these rows read differently from the heading bars.
        fontFamily: "inherit",
        display: "flex",
        width: "100%",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 1,
        textAlign: "left",
        px: 1.25,
        py: 0.75,
        borderRadius: 1.5,
        fontSize: 16,
        fontWeight: selected ? 700 : 500,
        color: selected ? SELECTED.fg : "text.primary",
        bgcolor: selected ? SELECTED.bg : "transparent",
        boxShadow: selected ? `inset 3px 0 0 ${SELECTED.accent}` : "none",
        "&:hover": { bgcolor: selected ? SELECTED.bgHover : "action.hover" },
        ...(featured && {
          px: 1.5,
          py: 1,
          border: "1.5px solid",
          borderColor: "secondary.main",
          bgcolor: selected ? SELECTED.bg : (theme: Theme) => alpha(theme.palette.secondary.main, 0.08),
          boxShadow: "none",
          ...(selected && { borderColor: SELECTED.accent }),
          fontWeight: 800,
          alignItems: "center",
          "&:hover": { bgcolor: selected ? SELECTED.bgHover : (theme: Theme) => alpha(theme.palette.secondary.main, 0.2) },
        }),
        ...(section && {
          ...SECTION_BAR,
          boxShadow: "none",
          ...(selected && { bgcolor: SELECTED.bg, color: SELECTED.fg, borderColor: SELECTED.accent }),
          "&:hover": { bgcolor: selected ? SELECTED.bgHover : (theme: Theme) => alpha(theme.palette.secondary.main, 0.26) },
        }),
      }}
    >
      <Box component="span" sx={{ minWidth: 0, wordBreak: "break-word" }}>
        {children}
      </Box>
      <Box component="span" sx={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 0.75 }}>
        {unread > 0 && (
          <Box
            component="span"
            aria-label={`${unread} 条新评论`}
            sx={{
              minWidth: 18,
              height: 18,
              px: 0.5,
              borderRadius: 9,
              bgcolor: UNREAD_BG,
              color: "common.white",
              fontSize: 12,
              lineHeight: "18px",
              textAlign: "center",
            }}
          >
            {unread}
          </Box>
        )}
      <Box
        component="span"
        sx={{
          fontSize: 14,
          lineHeight: "20px",
          color: selected ? SELECTED.fg : "text.secondary",
          opacity: count ? 1 : 0,
        }}
      >
        {count || 0}
      </Box>
      </Box>
    </ButtonBase>
  );
}
